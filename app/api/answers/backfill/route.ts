import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProvisionLeads } from "@/lib/answers/client";
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
  try {
    items = await fetchProvisionLeads(since);
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

  const summary = { created: 0, updated: 0, adopted: 0, geocoded: 0, status_changed: 0, skipped: 0 };
  const errors: string[] = [];

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
      } else {
        summary[res.action]++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${lead.id} (${lead.name}): ${message}`);
    }
  }

  const result = { ok: errors.length === 0, pulled: items.length, ...summary, errors };
  console.log("[answers-backfill]", JSON.stringify(result));
  return NextResponse.json(result);
}
