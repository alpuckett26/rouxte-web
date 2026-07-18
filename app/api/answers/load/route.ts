import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeAnswersLeadPayload,
  resolveOrgAdmin,
  upsertAnswersLead,
} from "@/lib/answers/upsertLead";

/**
 * POST /api/answers/load — the Rouxte lead-drop rail (rouxte-web#7).
 *
 * The Anseur spine pushes each newly sourced lead here the moment it exists,
 * so Rouxte loads it with zero relay. Auth: X-Answers-Secret header must match
 * ANSWERS_BUILD_SECRET. Body (per the issue contract):
 *   { "external_ref": "<restaurant_id>", "slug": "...",
 *     "profile": { "name": "...", "phone": "...", "address": "...", "brand": "..." } }
 *
 * Upsert rules are shared with the 15-min pull cron
 * (lib/answers/upsertLead.ts); the cron reconciles any push this rail misses,
 * so a failed push is never fatal to the pipeline.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ANSWERS_BUILD_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ANSWERS_BUILD_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("x-answers-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = process.env.ANSWERS_TARGET_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "ANSWERS_TARGET_ORG_ID is not set" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lead = normalizeAnswersLeadPayload(raw);
  if (!lead) {
    return NextResponse.json({ error: "external_ref is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const orgAdminId = await resolveOrgAdmin(admin, orgId);
    const result = await upsertAnswersLead(admin, orgId, orgAdminId, lead);
    console.log("[answers-load]", JSON.stringify({ external_ref: lead.id, ...result }));
    return NextResponse.json({ ok: true, external_ref: lead.id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[answers-load]", lead.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
