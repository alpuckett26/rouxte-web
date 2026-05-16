import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/me/chain
 *
 * Returns the accountability chain for the current user.
 *
 *   sales_rep:    { reports_to: [team_lead?, sales_manager?] }
 *   team_lead:    { teams: [{ id, name, member_count }], reports_to: [sales_manager?] }
 *   sales_manager:{ teams: [{ id, name, member_count }], reports_to: [admin?] }
 *   admin:        { teams: [...] }
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: viewer } = await admin
    .from("user_profiles")
    .select("user_id, org_id, team_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!viewer) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Teams the viewer is a member of
  const { data: myTeamRows } = await admin
    .from("team_members")
    .select("team_id")
    .eq("user_id", viewer.user_id);

  const myTeamIds = [...new Set(((myTeamRows ?? []).map((r) => r.team_id) ?? []))];
  // Also include user_profiles.team_id for managers who aren't in team_members
  if (viewer.team_id && !myTeamIds.includes(viewer.team_id)) myTeamIds.push(viewer.team_id);

  const { data: teams } = myTeamIds.length
    ? await admin.from("teams").select("id, name").in("id", myTeamIds)
    : { data: [] };

  // Count members per team
  const { data: memberCounts } = myTeamIds.length
    ? await admin.from("team_members").select("team_id, user_id").in("team_id", myTeamIds)
    : { data: [] };
  const memberCountByTeam: Record<string, number> = {};
  for (const m of memberCounts ?? []) memberCountByTeam[m.team_id] = (memberCountByTeam[m.team_id] ?? 0) + 1;

  // Find who reports above the viewer
  const reports_to: Array<{ role: string; full_name: string; user_id: string }> = [];

  if (viewer.role === "sales_rep" || viewer.role === "team_lead") {
    // For reps: find their team lead(s). For team leads: skip to manager.
    if (viewer.role === "sales_rep" && myTeamIds.length > 0) {
      const { data: leads } = await admin
        .from("user_profiles")
        .select("user_id, full_name, team_id, role")
        .eq("org_id", viewer.org_id)
        .eq("role", "team_lead")
        .in("team_id", myTeamIds);
      for (const l of leads ?? []) {
        reports_to.push({ role: "team_lead", full_name: l.full_name, user_id: l.user_id });
      }
    }

    // Any sales_managers in the org are above (we don't model strict per-rep
    // manager assignment yet; everyone reports up to the org's managers)
    const { data: managers } = await admin
      .from("user_profiles")
      .select("user_id, full_name, role")
      .eq("org_id", viewer.org_id)
      .eq("role", "sales_manager");
    for (const m of managers ?? []) {
      reports_to.push({ role: "sales_manager", full_name: m.full_name, user_id: m.user_id });
    }
  }

  if (viewer.role === "sales_manager") {
    const { data: admins } = await admin
      .from("user_profiles")
      .select("user_id, full_name, role")
      .eq("org_id", viewer.org_id)
      .eq("role", "admin");
    for (const a of admins ?? []) {
      reports_to.push({ role: "admin", full_name: a.full_name, user_id: a.user_id });
    }
  }

  return NextResponse.json({
    data: {
      role: viewer.role,
      teams: (teams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        member_count: memberCountByTeam[t.id] ?? 0,
      })),
      reports_to,
    },
  });
}
