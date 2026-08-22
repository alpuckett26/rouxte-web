import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProvisionLeads, type ProvisionFeedMeta } from "@/lib/answers/client";
import {
  normalizeAnswersLeadPayload,
  resolveOrgAdmin,
  upsertAnswersLead,
} from "@/lib/answers/upsertLead";

/**
 * POST /api/answers/backfill?since=<iso> — one-shot loader (rouxte-web#7).
 *
 * Pulls the spine's already-sourced leads from
 * GET <ANSWERS_API_URL>/internal/provision/leads?since=<iso> and runs each
 * through the shared Answers upsert. Operator-triggered (Bearer CRON_SECRET),
 * idempotent — safe to re-run; existing leads just refresh.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = process.env.ANSWERS_TARGET_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "ANSWERS_TARGET_ORG_ID is not set" }, { status: 500 });
  }

  const since = request.nextUrl.searchParams.get("since") ?? undefined;

  let items: unknown[];
  let feed: ProvisionFeedMeta;
  try {
    ({ leads: items, meta: feed } = await fetchProvisionLeads(since));
  } catch (err) {
    const message = err instanceof Error ? err.message : "provision leads fetch failed";
    console.error("[answers-backfill]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();

  let orgAdminId: string;
  try {
    orgAdminId = await resolveOrgAdmin(admin, orgId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const summary = { created: 0, updated: 0, adopted: 0, geocoded: 0, status_changed: 0, skipped: 0, refused: 0 };
  const errors: string[] = [];
  // Same split as the cron (/api/cron/answers-sync): refusals are the gate
  // working, not the rail failing, so they ride their own list. This route is
  // the one the bulk insert pass actually runs on, so a refusal here must be
  // legible per-lead — a count alone would tell an operator that some rows did
  // not land without telling them which, or why.
  const refusals: string[] = [];

  for (const item of items) {
    const lead = normalizeAnswersLeadPayload(item);
    if (!lead) {
      summary.skipped++;
      errors.push("record without external_ref, skipped");
      continue;
    }
    try {
      const res = await upsertAnswersLead(admin, orgId, orgAdminId, lead);
      if (res.geocoded) summary.geocoded++;
      if (res.statusChanged) summary.status_changed++;
      if (res.action === "skipped") {
        summary.skipped++;
        if (res.reason) errors.push(`${lead.id} (${lead.name}): ${res.reason}`);
      } else if (res.action === "refused") {
        summary.refused++;
        refusals.push(`${lead.id} (${lead.name}): ${res.reason ?? "refused"}`);
      } else {
        summary[res.action]++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${lead.id} (${lead.name}): ${message}`);
    }
  }

  // A pull of zero is not a success — it's the shape the silent zero took the
  // first time (rouxte-web#16). Say so out loud rather than returning a clean
  // ok:true that loaded nothing.
  //
  // The same shape has a second form now that the gate can refuse: a run that
  // pulls 29 and lands none of them is just as green-looking as one that
  // pulled none, and it is the likelier outcome of a bad adopt gate. Both are
  // reported as a warning, so "nothing changed" can never be read as "done".
  const landed = summary.created + summary.updated + summary.adopted;
  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push(
      "spine returned 0 records — nothing was loaded; check ANSWERS_API_URL and the provision feed before reading this as done",
    );
  } else if (landed === 0) {
    warnings.push(
      `pulled ${items.length} records but landed 0 (refused ${summary.refused}, skipped ${summary.skipped}) — nothing was written; read the refusals before treating this as done`,
    );
  }
  // A TRUNCATED FEED IS NOT A COMPLETE ONE, and a backfill is exactly the
  // caller that reads "I loaded them all" off a full page. The spine started
  // reporting this on 2026-08-15; a deploy that does not send the header leaves
  // `truncated` null, which is UNKNOWN and gets no claim either way.
  if (feed.truncated === true) {
    warnings.push(
      `the spine reported this feed page as TRUNCATED (count ${feed.count ?? "?"} of limit ${feed.limit ?? "?"}) — ` +
        `records beyond the page were never pulled; re-run with a later ?since= until it stops truncating before calling the backfill complete`,
    );
  }

  const result = {
    ok: errors.length === 0,
    pulled: items.length,
    ...summary,
    feed,
    errors,
    refusals,
    // Kept singular alongside the list so an operator (or a script) reading the
    // old field still sees the loudest problem rather than nothing.
    ...(warnings.length ? { warning: warnings[0], warnings } : {}),
  };
  console.log("[answers-backfill]", JSON.stringify(result));
  return NextResponse.json(result);
}
