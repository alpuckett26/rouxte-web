import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

/**
 * GET /api/admin/orgs/[org_id]
 * Super-admin only. Returns a full troubleshooting snapshot for one org:
 *   - org row + onboarding state
 *   - subscription
 *   - recent billing charges (last 12)
 *   - users with role + last sign-in (best-effort)
 *   - lead counts by status
 *   - last 50 sales_activity_log events
 *   - invites pending
 *   - comp plans
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ org_id: string }> },
) {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const { org_id } = await ctx.params;
  const admin = createAdminClient();

  const [
    orgRes, subRes, chargesRes, profilesRes, leadsRes,
    activityRes, invitesRes, compPlansRes,
  ] = await Promise.all([
    admin.from("orgs").select("*").eq("id", org_id).maybeSingle(),
    admin.from("org_subscriptions").select("*").eq("org_id", org_id).maybeSingle(),
    admin.from("billing_charges").select("*").eq("org_id", org_id).order("created_at", { ascending: false }).limit(12),
    admin.from("user_profiles").select("user_id, role, full_name, team_id, onboarding_step, onboarding_complete, created_at").eq("org_id", org_id).order("created_at", { ascending: true }),
    admin.from("leads").select("status").eq("org_id", org_id),
    admin.from("sales_activity_log").select("id, lead_id, actor_id, event_type, summary, is_incident, created_at").eq("org_id", org_id).order("created_at", { ascending: false }).limit(50),
    admin.from("invites").select("id, email, role, created_at, accepted_at").eq("org_id", org_id).order("created_at", { ascending: false }).limit(50),
    admin.from("comp_plans").select("*").eq("org_id", org_id).order("carrier", { ascending: true }),
  ]);

  if (!orgRes.data) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Lead counts by status
  const leadStatusCounts: Record<string, number> = {};
  for (const l of (leadsRes.data ?? [])) {
    leadStatusCounts[l.status] = (leadStatusCounts[l.status] ?? 0) + 1;
  }

  return NextResponse.json({
    data: {
      org: orgRes.data,
      subscription: subRes.data ?? null,
      billing_charges: chargesRes.data ?? [],
      users: profilesRes.data ?? [],
      lead_counts: leadStatusCounts,
      lead_total: (leadsRes.data ?? []).length,
      recent_activity: activityRes.data ?? [],
      invites: invitesRes.data ?? [],
      comp_plans: compPlansRes.data ?? [],
    },
  });
}
