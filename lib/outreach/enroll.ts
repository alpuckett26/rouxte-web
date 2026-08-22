/**
 * Cohort enrolment (rouxte-web#18, items 1 and 3).
 *
 * Takes the cohort FROM THE SPINE's segment query and enrols the matching
 * Rouxte leads in a sequence. It does not build the cohort itself, and it will
 * not fall back to building it from `leads.signals` if the segment call fails —
 * a rail that silently substitutes its own list for the shared one is exactly
 * the quiet disagreement the segment endpoint exists to prevent. It errors out
 * instead.
 *
 * Enrolment writes NO email. It sets a cursor; the dispatcher sends, and the
 * send gate runs there against a fresh row. The split is deliberate: consent
 * checked at enrolment is consent checked at import, which is the thing item 2
 * says is not good enough.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchProvisionSegment, type AnswersSegment } from "@/lib/answers/client";
import { canEnrol, getSequence, nextDueAt } from "./sequences";
import { evaluateSendGate } from "./suppression";

type Admin = ReturnType<typeof createAdminClient>;

export interface EnrolSummary {
  ok: boolean;
  sequence: string;
  signal: string | null;
  /** Straight from the spine — what it says the cohort is. */
  segment: { tagged: number; contactable: number; returned: number } | null;
  /** Segment members with no matching Rouxte lead (external_ref never landed). */
  unmatched: string[];
  enrolled: number;
  alreadyEnrolled: number;
  /** Would be suppressed today. Enrolled anyway ONLY when the reason is fixable — see below. */
  notSendable: Record<string, number>;
  skipped: number;
  refusal?: string;
  warnings: string[];
}

export interface EnrolOptions {
  orgId: string;
  sequenceKey: string;
  now?: Date;
  enrolledBy?: string | null;
  dryRun?: boolean;
  /** Cap on how many leads one call may enrol. */
  limit?: number;
}

const LEAD_COLUMNS =
  "id, org_id, external_ref, customer_name, address, phone, do_not_contact, is_opt_out, " +
  "is_do_not_knock, contact_name, contact_email, contact_phone, contact_source, contact_sourced_at";

export async function enrolSegment(admin: Admin, options: EnrolOptions): Promise<EnrolSummary> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 500;
  const seq = getSequence(options.sequenceKey);

  const summary: EnrolSummary = {
    ok: false,
    sequence: options.sequenceKey,
    signal: seq?.signal ?? null,
    segment: null,
    unmatched: [],
    enrolled: 0,
    alreadyEnrolled: 0,
    notSendable: {},
    skipped: 0,
    warnings: [],
  };

  if (!seq) {
    summary.refusal = `unknown sequence "${options.sequenceKey}"`;
    return summary;
  }
  if (!seq.signal) {
    summary.refusal = `sequence "${seq.key}" has no signal — there is no segment query to read, so there is no cohort to enrol`;
    return summary;
  }

  // Item 3: refuse to start a deadline sequence with no runway. This is a
  // refusal, not a warning — it is the difference between timing outreach off
  // the shutdown and merely mentioning it.
  const timing = canEnrol(seq, now);
  if (!timing.ok) {
    summary.refusal = timing.detail;
    return summary;
  }

  let segment: AnswersSegment;
  try {
    segment = await fetchProvisionSegment(seq.signal, { contactableOnly: true });
  } catch (err) {
    summary.refusal = `segment fetch failed: ${err instanceof Error ? err.message : String(err)} — refusing to derive the cohort locally`;
    return summary;
  }

  summary.segment = {
    tagged: segment.tagged,
    contactable: segment.contactable,
    returned: segment.restaurants.length,
  };

  // AN EMPTY COHORT IS A RESULT, AND IT IS NOT A SUCCESS. Reporting ok:true and
  // enrolled:0 off an empty segment is the silent zero all over again.
  if (segment.restaurants.length === 0) {
    summary.ok = true;
    summary.warnings.push(
      `the spine's segment for signal "${seq.signal}" is EMPTY (tagged ${segment.tagged}, contactable ${segment.contactable}) — ` +
        `nothing was enrolled because there is nobody in the cohort, not because the enrolment worked`,
    );
    return summary;
  }

  const refs = segment.restaurants.map((m) => m.restaurant_id).filter(Boolean).slice(0, limit);
  if (segment.restaurants.length > limit) {
    summary.warnings.push(
      `segment returned ${segment.restaurants.length} but this call is capped at ${limit} — ${segment.restaurants.length - limit} were not considered`,
    );
  }

  const { data: leadRows, error: leadErr } = await admin
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("org_id", options.orgId)
    .eq("external_source", "answers")
    .in("external_ref", refs);

  if (leadErr) {
    summary.refusal = `lead lookup failed: ${leadErr.message}`;
    return summary;
  }

  const leads = (leadRows ?? []) as unknown as Array<Record<string, unknown> & { id: string; external_ref: string }>;
  const byRef = new Map(leads.map((l) => [l.external_ref, l]));
  summary.unmatched = refs.filter((r) => !byRef.has(r));
  if (summary.unmatched.length) {
    summary.warnings.push(
      `${summary.unmatched.length} segment members have no Rouxte lead on external_ref — run the backfill before enrolling, or they simply will not be contacted`,
    );
  }

  const { data: existingRows } = await admin
    .from("lead_outreach")
    .select("lead_id")
    .eq("org_id", options.orgId)
    .eq("sequence_key", seq.key)
    .in("lead_id", leads.map((l) => l.id));
  const already = new Set(((existingRows ?? []) as { lead_id: string }[]).map((r) => r.lead_id));

  const firstDue = nextDueAt(seq, 1, now, now);

  for (const lead of leads) {
    if (already.has(lead.id)) {
      summary.alreadyEnrolled++;
      continue;
    }

    // A preview of the gate, not the gate. Its verdict is COUNTED so an
    // enrolment that will send nothing says so up front, but a consent refusal
    // is the only thing that stops the enrolment: "no email yet" and "no
    // provenance yet" are both fixable, and a cursor waiting on a fix is more
    // useful than a lead quietly left out of the cohort.
    const verdict = evaluateSendGate(lead, seq.steps[0].channel);
    if (!verdict.allowed) {
      summary.notSendable[verdict.reason] = (summary.notSendable[verdict.reason] ?? 0) + 1;
      if (verdict.reason === "do_not_contact" || verdict.reason === "opted_out") {
        summary.skipped++;
        continue;
      }
    }

    if (options.dryRun) {
      summary.enrolled++;
      continue;
    }

    const { error: insErr } = await admin.from("lead_outreach").insert({
      org_id: options.orgId,
      lead_id: lead.id,
      sequence_key: seq.key,
      current_step: 0,
      next_due_at: (firstDue ?? now).toISOString(),
      state: "active",
      enrolled_by: options.enrolledBy ?? null,
    });
    if (insErr) {
      // A unique-violation is a concurrent enrolment, not a failure.
      if (insErr.message.includes("duplicate key")) summary.alreadyEnrolled++;
      else summary.warnings.push(`${lead.id}: enrol failed — ${insErr.message}`);
      continue;
    }
    summary.enrolled++;
  }

  summary.ok = true;
  return summary;
}
