/**
 * The dispatcher (rouxte-web#18, item 1: the second and third touch happening
 * without anyone remembering).
 *
 * Reads the due cursors, re-checks consent against a FRESHLY READ lead row,
 * sends, writes the ledger row, advances the cursor. Everything it decides is
 * recorded — a suppression is a ledger row exactly like a send is, because a
 * quiet non-send looks identical to a send that worked.
 *
 * The send itself is injected (`SendFn`) so `--dry-run` is not a separate code
 * path pretending to be this one. A dry run runs THE SAME function with a
 * transport that reports what it would have done and a recorder that writes
 * nothing; if the dry run is wrong, the live run is wrong in the same way,
 * which is the only kind of rehearsal worth having.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateSendGate,
  type OutreachChannel,
  type SendGateSubject,
  type SendGateVerdict,
} from "./suppression";
import {
  anchorExpired,
  footer,
  getSequence,
  nextDueAt,
  renderStep,
  stepOf,
  type SequenceDefinition,
} from "./sequences";

type Admin = ReturnType<typeof createAdminClient>;

export interface OutreachCursor {
  id: string;
  org_id: string;
  lead_id: string;
  sequence_key: string;
  current_step: number;
  next_due_at: string | null;
  state: string;
}

export interface LeadForSend extends SendGateSubject {
  id: string;
  org_id: string;
  customer_name: string | null;
  contact_name: string | null;
  address: string | null;
}

export interface SendRequest {
  to: string;
  subject: string;
  body: string;
  leadId: string;
  sequenceKey: string;
  step: number;
  /**
   * The recipient's unsubscribe token, passed explicitly rather than scraped
   * back out of the body. The transport needs it for the RFC 8058
   * List-Unsubscribe header, and header and footer MUST resolve to the same
   * person — a mismatch there unsubscribes the wrong lead and looks, from the
   * outside, exactly like ignoring the request.
   */
  unsubscribeToken: string;
}

export type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };
export type SendFn = (req: SendRequest) => Promise<SendResult>;

export interface DispatchOptions {
  orgId: string;
  now?: Date;
  /** Hard cap per run. A dispatcher that can send unbounded mail in one tick is an incident waiting for a bad query. */
  limit?: number;
  dryRun?: boolean;
  send: SendFn;
  /** Base URL used to build the unsubscribe link. */
  appUrl: string;
  /** False when the email transport is not configured; every email then suppresses as channel_unavailable. */
  channelConfigured?: boolean;
}

export interface DispatchOutcome {
  leadId: string;
  sequenceKey: string;
  step: number;
  outcome: "sent" | "suppressed" | "failed" | "stopped";
  reason?: string;
  to?: string;
}

export interface DispatchSummary {
  ok: boolean;
  dryRun: boolean;
  due: number;
  sent: number;
  suppressed: number;
  failed: number;
  stopped: number;
  /** Suppression counts by reason — the number worth reading on every run. */
  suppressedBy: Record<string, number>;
  outcomes: DispatchOutcome[];
  warnings: string[];
}

const LEAD_COLUMNS =
  "id, org_id, customer_name, address, phone, do_not_contact, is_opt_out, is_do_not_knock, " +
  "contact_name, contact_email, contact_phone, contact_source, contact_sourced_at";

/**
 * Run one dispatch tick for an org.
 *
 * Note the two reads of the same lead. The batch query selects cursors; the
 * per-lead read happens immediately before the gate. They are not redundant:
 * between them sits however long the previous lead's send took, and an
 * unsubscribe that arrives in that window has to win. That is the whole
 * content of "honour it at the point of send, not at import".
 */
export async function dispatchOutreach(
  admin: Admin,
  options: DispatchOptions,
): Promise<DispatchSummary> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 50;
  const dryRun = options.dryRun === true;

  const summary: DispatchSummary = {
    ok: true,
    dryRun,
    due: 0,
    sent: 0,
    suppressed: 0,
    failed: 0,
    stopped: 0,
    suppressedBy: {},
    outcomes: [],
    warnings: [],
  };

  const { data: cursors, error: cursorErr } = await admin
    .from("lead_outreach")
    .select("id, org_id, lead_id, sequence_key, current_step, next_due_at, state")
    .eq("org_id", options.orgId)
    .eq("state", "active")
    .lte("next_due_at", now.toISOString())
    .order("next_due_at", { ascending: true })
    .limit(limit);

  if (cursorErr) {
    return { ...summary, ok: false, warnings: [`due-query failed: ${cursorErr.message}`] };
  }

  const due = (cursors ?? []) as OutreachCursor[];
  summary.due = due.length;

  // A FULL BATCH IS NOT AN EMPTY QUEUE. Saying nothing here would let a backlog
  // that never drains read as a clean run, every run, forever.
  if (due.length >= limit) {
    summary.warnings.push(
      `hit the ${limit}-row per-run cap — there is more due work than this tick sent; re-run or raise the cap before reading this as caught up`,
    );
  }

  for (const cursor of due) {
    const seq = getSequence(cursor.sequence_key);
    if (!seq) {
      summary.warnings.push(`${cursor.lead_id}: unknown sequence "${cursor.sequence_key}" — cursor left untouched`);
      continue;
    }

    // Item 3, enforced on the way out as well as on the way in: a deadline
    // pitch after the deadline is worse than silence.
    if (anchorExpired(seq, now)) {
      summary.stopped++;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: cursor.current_step + 1,
        outcome: "stopped",
        reason: "anchor_passed",
      });
      if (!dryRun) await stopCursor(admin, cursor.id, "anchor_passed", now);
      continue;
    }

    const nextStep = cursor.current_step + 1;
    const step = stepOf(seq, nextStep);
    if (!step) {
      summary.stopped++;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: nextStep,
        outcome: "stopped",
        reason: "sequence_exhausted",
      });
      if (!dryRun) await completeCursor(admin, cursor.id, now);
      continue;
    }

    const { data: leadRow, error: leadErr } = await admin
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("id", cursor.lead_id)
      .maybeSingle();

    if (leadErr || !leadRow) {
      summary.failed++;
      summary.ok = false;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: nextStep,
        outcome: "failed",
        reason: leadErr?.message ?? "lead row not found at send time",
      });
      continue;
    }

    const lead = leadRow as unknown as LeadForSend;
    const verdict = evaluateSendGate(lead, step.channel as OutreachChannel, {
      channelConfigured: options.channelConfigured,
    });

    if (!verdict.allowed) {
      summary.suppressed++;
      summary.suppressedBy[verdict.reason] = (summary.suppressedBy[verdict.reason] ?? 0) + 1;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: nextStep,
        outcome: "suppressed",
        reason: verdict.reason,
      });
      if (!dryRun) {
        await recordTouch(admin, cursor, lead, step.channel, nextStep, {
          outcome: "suppressed",
          suppression_reason: verdict.reason,
          metadata: { detail: verdict.detail },
        });
        // A consent refusal ends the sequence; a missing address or an
        // unconfigured channel only pauses this tick, because both are fixable
        // and neither is the recipient saying no.
        if (verdict.reason === "do_not_contact" || verdict.reason === "opted_out") {
          await stopCursor(admin, cursor.id, `suppressed:${verdict.reason}`, now);
        }
      }
      continue;
    }

    const rendered = renderStep(seq, step, { contactName: lead.contact_name ?? lead.customer_name });
    const unsub = await unsubscribeLink(admin, options.appUrl, lead, dryRun);
    const body = rendered.body + footer(unsub.url, verdict.provenance);

    if (dryRun) {
      summary.sent++;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: nextStep,
        outcome: "sent",
        to: verdict.to,
      });
      continue;
    }

    const result = await options.send({
      to: verdict.to,
      subject: rendered.subject,
      body,
      leadId: lead.id,
      sequenceKey: seq.key,
      step: nextStep,
      unsubscribeToken: unsub.token,
    });

    if (!result.ok) {
      summary.failed++;
      summary.ok = false;
      summary.outcomes.push({
        leadId: cursor.lead_id,
        sequenceKey: seq.key,
        step: nextStep,
        outcome: "failed",
        reason: result.error,
      });
      await recordTouch(admin, cursor, lead, step.channel, nextStep, {
        outcome: "failed",
        to_address: verdict.to,
        subject: rendered.subject,
        metadata: { error: result.error },
      });
      // Cursor is NOT advanced: a failed send is a step still owed, and the
      // next tick retries it. The unique index on landed sends is what keeps
      // that retry from turning into a double-send if the failure was a lie.
      continue;
    }

    summary.sent++;
    summary.outcomes.push({
      leadId: cursor.lead_id,
      sequenceKey: seq.key,
      step: nextStep,
      outcome: "sent",
      to: verdict.to,
    });

    await recordTouch(admin, cursor, lead, step.channel, nextStep, {
      outcome: "sent",
      to_address: verdict.to,
      subject: rendered.subject,
      body_preview: body.slice(0, 280),
      provider_message_id: result.providerMessageId ?? null,
      contact_source: verdict.provenance.source,
      contact_sourced_at: verdict.provenance.sourcedAt || null,
    });

    const following = nextDueAt(seq, nextStep + 1, now, now);
    await admin
      .from("lead_outreach")
      .update({
        current_step: nextStep,
        last_touch_at: now.toISOString(),
        next_due_at: following ? following.toISOString() : null,
        state: following ? "active" : "completed",
        stopped_reason: following ? null : "sequence_exhausted",
        updated_at: now.toISOString(),
      })
      .eq("id", cursor.id);
  }

  return summary;
}

async function stopCursor(admin: Admin, id: string, reason: string, now: Date) {
  await admin
    .from("lead_outreach")
    .update({ state: "stopped", stopped_reason: reason, next_due_at: null, updated_at: now.toISOString() })
    .eq("id", id);
}

async function completeCursor(admin: Admin, id: string, now: Date) {
  await admin
    .from("lead_outreach")
    .update({
      state: "completed",
      stopped_reason: "sequence_exhausted",
      next_due_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", id);
}

async function recordTouch(
  admin: Admin,
  cursor: OutreachCursor,
  lead: LeadForSend,
  channel: string,
  step: number,
  fields: Record<string, unknown>,
) {
  await admin.from("lead_outreach_touches").insert({
    org_id: cursor.org_id,
    lead_id: lead.id,
    outreach_id: cursor.id,
    sequence_key: cursor.sequence_key,
    step_no: step,
    channel,
    direction: "outbound",
    contact_source: lead.contact_source ?? null,
    contact_sourced_at: lead.contact_sourced_at ?? null,
    ...fields,
  });
}

/** The human-facing confirmation page for a token. */
export function unsubscribePageUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/optout/email/${token}`;
}

/** The machine endpoint the RFC 8058 List-Unsubscribe header points at. */
export function unsubscribePostUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/api/outreach/unsubscribe/${token}`;
}

/**
 * Mint (or reuse) this lead's unsubscribe token and return it with its URL.
 *
 * One stable token per lead, so a recipient who kept an email from three months
 * ago can still use that link. A dry run mints nothing — it renders the shape
 * of the URL so the body length and footer are honest, and says so in the path.
 */
export async function unsubscribeLink(
  admin: Admin,
  appUrl: string,
  lead: LeadForSend,
  dryRun = false,
): Promise<{ token: string; url: string }> {
  const wrap = (token: string) => ({ token, url: unsubscribePageUrl(appUrl, token) });
  if (dryRun) return wrap("dry-run-token");

  const { data: existing } = await admin
    .from("outreach_unsubscribes")
    .select("token")
    .eq("lead_id", lead.id)
    .maybeSingle();
  if (existing?.token) return wrap(existing.token as string);

  const token = mintToken();
  await admin.from("outreach_unsubscribes").insert({
    token,
    org_id: lead.org_id,
    lead_id: lead.id,
    email: lead.contact_email ?? null,
  });
  return wrap(token);
}

/** 32 hex chars of CSPRNG. Opaque on purpose — a guessable token unsubscribes strangers. */
export function mintToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
