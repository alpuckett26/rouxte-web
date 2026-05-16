import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { canViewerSeeUser } from "@/lib/auth/lead-scope";

/**
 * GET /api/manager/reps/[user_id]
 *
 * Returns a single-rep snapshot for the manager/team-lead drill-down.
 * Gated by getVisibleRepIds — a team lead can only fetch reps on their
 * team; a manager/admin can fetch any rep in their org; a super-admin
 * can fetch any rep anywhere.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ user_id: string }> },
) {
  const { user_id: targetUserId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: viewerProfile } = await admin
    .from("user_profiles")
    .select("user_id, org_id, team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!viewerProfile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const allowed = await canViewerSeeUser(
    admin,
    { ...viewerProfile, email: user.email ?? null },
    targetUserId,
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch the rep's profile + lead pipeline + last-7d activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [profileRes, leadsRes, activityRes] = await Promise.all([
    admin.from("user_profiles")
      .select("user_id, full_name, role, team_id, avatar_url, created_at, total_sales_count, graduated_at, phone, territory")
      .eq("user_id", targetUserId)
      .maybeSingle(),
    admin.from("leads")
      .select("id, address, status, updated_at, customer_name, assigned_at")
      .eq("assigned_to", targetUserId)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin.from("sales_activity_log")
      .select("id, event_type, summary, ts, lead_id, is_incident, metadata")
      .eq("actor_id", targetUserId)
      .gte("ts", sevenDaysAgo)
      .order("ts", { ascending: false })
      .limit(100),
  ]);

  if (!profileRes.data) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

  // Roll up activity counts
  const activity = activityRes.data ?? [];
  const counts: Record<string, number> = {};
  for (const a of activity) counts[a.event_type] = (counts[a.event_type] ?? 0) + 1;

  // Status mix of assigned leads
  const leads = leadsRes.data ?? [];
  const statusMix: Record<string, number> = {};
  for (const l of leads) statusMix[l.status] = (statusMix[l.status] ?? 0) + 1;

  return NextResponse.json({
    data: {
      profile: profileRes.data,
      leads,
      status_mix: statusMix,
      last_7d: {
        total_events: activity.length,
        counts,
      },
      recent_activity: activity.slice(0, 20),
    },
  });
}
