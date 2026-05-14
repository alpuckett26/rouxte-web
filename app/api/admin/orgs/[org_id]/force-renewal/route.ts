import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { processSubscription, type SubRow } from "@/lib/billing/renewal-engine";

/**
 * POST /api/admin/orgs/[org_id]/force-renewal
 *
 * Super-admin only. Runs the renewal engine for one org with force=true
 * so we don't have to wait for the trial end / period rollover. Real
 * money moves — Square is hit. Use sparingly.
 */
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ org_id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const { org_id } = await ctx.params;
  const admin = createAdminClient();

  const { data: sub, error } = await admin
    .from("org_subscriptions")
    .select("*")
    .eq("org_id", org_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sub) return NextResponse.json({ error: "No subscription for this org" }, { status: 404 });

  const result = await processSubscription(admin, sub as SubRow, { force: true });

  return NextResponse.json({ ok: true, result });
}
