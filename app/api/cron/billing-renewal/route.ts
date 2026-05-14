import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processSubscription, type SubRow, type RenewalResult } from "@/lib/billing/renewal-engine";

/**
 * GET /api/cron/billing-renewal
 * Vercel cron — daily at 00:05 UTC. Auth via `Bearer ${CRON_SECRET}`.
 *
 * Loops every trialing/active/past_due subscription and asks the
 * renewal engine to process it. The engine handles dueness, idempotency,
 * Square charges, and status transitions.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: subs, error } = await admin
    .from("org_subscriptions")
    .select("*")
    .in("status", ["trialing", "active", "past_due"]);

  if (error) {
    console.error("[billing-renewal] fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: RenewalResult[] = [];
  for (const sub of (subs ?? []) as SubRow[]) {
    results.push(await processSubscription(admin, sub));
  }

  return NextResponse.json({
    ok: true,
    ran_at: nowIso,
    processed: results.length,
    results,
  });
}
