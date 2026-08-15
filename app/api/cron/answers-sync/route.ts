import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAnswersPipeline, type AnswersPipelineRestaurant } from "@/lib/answers/client";
import { resolveOrgAdmin, upsertAnswersLead } from "@/lib/answers/upsertLead";

/**
 * GET /api/cron/answers-sync
 * Vercel cron — pulls the Anseur (Answers) restaurant pipeline and upserts
 * leads keyed on external_ref = Answers restaurant_id.
 *
 * The upsert rules (match → adopt → insert, status precedence, geocoding)
 * live in lib/answers/upsertLead.ts, shared with the push rail
 * /api/answers/load (rouxte-web#7). This cron doubles as the reconciliation
 * pass for any push the rail missed.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = process.env.ANSWERS_TARGET_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "ANSWERS_TARGET_ORG_ID is not set" }, { status: 500 });
  }

  let pipeline: AnswersPipelineRestaurant[];
  try {
    pipeline = await fetchAnswersPipeline();
  } catch (err) {
    const message = err instanceof Error ? err.message : "pipeline fetch failed";
    console.error("[answers-sync]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();

  let orgAdminId: string;
  try {
    // created_by is required on leads — attribute cron-created leads to an org admin
    orgAdminId = await resolveOrgAdmin(admin, orgId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const summary = { created: 0, updated: 0, adopted: 0, geocoded: 0, status_changed: 0, skipped: 0, refused: 0 };
  const errors: string[] = [];
  // Refusals are not errors — the gate declining to guess is it working. They
  // ride their own list so a refused lead can never be read as a synced one,
  // and so a run that refuses everything cannot report ok:true and look clean.
  const refusals: string[] = [];

  for (const r of pipeline) {
    try {
      if (!r.id) continue;
      const res = await upsertAnswersLead(admin, orgId, orgAdminId, r);
      if (res.geocoded) summary.geocoded++;
      if (res.statusChanged) summary.status_changed++;
      if (res.action === "skipped") {
        summary.skipped++;
        if (res.reason) errors.push(`${r.id} (${r.name}): ${res.reason}`);
      } else if (res.action === "refused") {
        summary.refused++;
        refusals.push(`${r.id} (${r.name}): ${res.reason ?? "refused"}`);
      } else {
        summary[res.action]++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${r.id} (${r.name}): ${message}`);
    }
  }

  const result = { ok: errors.length === 0, pulled: pipeline.length, ...summary, errors, refusals };
  console.log("[answers-sync]", JSON.stringify(result));
  return NextResponse.json(result);
}
