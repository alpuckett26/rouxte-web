import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

const GRADUATION_THRESHOLD = 10;

/**
 * POST /api/leads/[id]/log-sale
 *
 * Atomically logs a sale + flips the lead to status=sold. Replaces the
 * previous side-effect pattern where clicking the "Sold" status chip
 * pre-flipped the lead and only THEN opened LogSaleModal — if the rep
 * cancelled the modal the lead was already marked sold with no metadata.
 *
 * Body (same shape as the old POST /api/logs payload for sale_submitted):
 *   {
 *     summary?: string,
 *     metadata: {
 *       package_id, package_name, package_category,
 *       speed_mbps, wireless_added,
 *       payout_amount, commission_pct, commission_amount, tier_name,
 *       customer_name, install_date?, notes?
 *     }
 *   }
 *
 * Order of writes (no transactions in supabase-js):
 *   1. status → 'sold'   (revertible cheaply if step 2 fails)
 *   2. sales_activity_log insert
 *   3. user_profiles.total_sales_count increment + graduation check
 *
 * If (2) fails, we revert the status to whatever it was. Worst-case
 * partial failure is still better than the previous flow which could
 * leave a lead marked sold with no row in the activity log.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: leadId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  let body: { summary?: string; metadata?: Record<string, unknown> };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const metadata = body.metadata ?? {};
  const customerName = typeof metadata.customer_name === "string" ? metadata.customer_name : "";
  const summary = body.summary?.trim()
    ?? `Sale: ${metadata.package_name ?? "Package"} — ${customerName || "customer"}`;

  // 1. Snapshot prior status so we can revert on failure
  const { data: existing, error: existingErr } = await admin
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();
  if (existingErr || !existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const priorStatus = existing.status;

  // 2. Flip lead → sold
  const { error: updateErr } = await admin
    .from("leads")
    .update({ status: "sold", updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 3. Insert sales_activity_log row
  const { data: log, error: logErr } = await admin
    .from("sales_activity_log")
    .insert({
      org_id:     profile.org_id,
      lead_id:    leadId,
      actor_id:   user.id,
      team_id:    profile.team_id ?? null,
      event_type: "sale_submitted",
      summary,
      metadata,
      is_incident: false,
    })
    .select()
    .single();

  if (logErr) {
    // Revert status so we don't leave a sold-without-metadata orphan
    await admin
      .from("leads")
      .update({ status: priorStatus, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  // 4. Increment total_sales_count + check graduation (mirrors /api/logs)
  const { data: rep } = await admin
    .from("user_profiles")
    .select("total_sales_count, graduated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (rep) {
    const newCount = (rep.total_sales_count ?? 0) + 1;
    const graduatedNow = !rep.graduated_at && newCount >= GRADUATION_THRESHOLD;
    await admin
      .from("user_profiles")
      .update({
        total_sales_count: newCount,
        ...(graduatedNow ? { graduated_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, log });
}
