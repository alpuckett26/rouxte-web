import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

/**
 * GET /api/admin/orgs
 * Super-admin only. Lists every org with quick summary stats for the
 * troubleshooting console.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const admin = createAdminClient();

  const { data: orgs, error } = await admin
    .from("orgs")
    .select("id, name, created_at, onboarding_state, onboarding_completed_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull subscription + user count per org in parallel
  const orgIds = (orgs ?? []).map((o) => o.id);

  const [subsRes, usersRes, leadsRes] = await Promise.all([
    admin.from("org_subscriptions").select("org_id, status, tier_key, trial_ends_at, current_period_end").in("org_id", orgIds),
    admin.from("user_profiles").select("org_id").in("org_id", orgIds),
    admin.from("leads").select("org_id, status").in("org_id", orgIds),
  ]);

  const subByOrg = new Map<string, { status: string; tier_key: string; trial_ends_at: string; current_period_end: string | null }>();
  for (const s of (subsRes.data ?? [])) subByOrg.set(s.org_id, s);

  const userCountByOrg = new Map<string, number>();
  for (const u of (usersRes.data ?? [])) userCountByOrg.set(u.org_id, (userCountByOrg.get(u.org_id) ?? 0) + 1);

  const leadCountByOrg = new Map<string, number>();
  for (const l of (leadsRes.data ?? [])) leadCountByOrg.set(l.org_id, (leadCountByOrg.get(l.org_id) ?? 0) + 1);

  const data = (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    created_at: o.created_at,
    onboarding_completed_at: o.onboarding_completed_at,
    shape: (o.onboarding_state as { shape?: string } | null)?.shape ?? null,
    subscription: subByOrg.get(o.id) ?? null,
    user_count: userCountByOrg.get(o.id) ?? 0,
    lead_count: leadCountByOrg.get(o.id) ?? 0,
  }));

  return NextResponse.json({ data });
}
