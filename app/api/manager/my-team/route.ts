import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/manager/my-team[?team_id=<uuid>]
// Returns the caller's team (for team leads) with members + per-member stats.
// Also accessible to sales_manager/admin (returns their assigned team, or any
// team in their org if ?team_id=<uuid> is provided).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  if (profile.role === "sales_rep") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pick the team: explicit override (admin only) or the caller's own.
  // Managers/team_leads can only view their assigned team. Multi-team-per-manager
  // would need a manager_teams join table — out of scope until then.
  const teamIdParam = req.nextUrl.searchParams.get("team_id");
  let resolvedTeamId: string | null = profile.team_id;
  if (teamIdParam) {
    if (profile.role !== "admin") {
      // Allow only if it matches their own team_id (no-op override).
      if (teamIdParam !== profile.team_id) {
        return NextResponse.json({ error: "Only admin can view other teams" }, { status: 403 });
      }
    }
    resolvedTeamId = teamIdParam;
  }

  if (!resolvedTeamId) {
    return NextResponse.json({ data: null, message: "Not assigned to a team" });
  }

  // Get team info — also enforce same-org for the explicit override case
  const { data: team } = await admin
    .from("teams")
    .select("id, name, tier, org_id")
    .eq("id", resolvedTeamId)
    .maybeSingle();
  if (team && team.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Team not in your org" }, { status: 403 });
  }

  if (!team) return NextResponse.json({ data: null, message: "Team not found" });

  // Get all members of this team
  const { data: members } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role, created_at")
    .eq("team_id", resolvedTeamId)
    .order("full_name");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Enrich each member with leads count and sales this month
  const enriched = await Promise.all(
    (members ?? []).map(async (member) => {
      const [{ count: leadsCount }, { count: salesCount }] = await Promise.all([
        admin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", member.user_id),
        admin
          .from("sales_activity_log")
          .select("id", { count: "exact", head: true })
          .eq("actor_id", member.user_id)
          .eq("event_type", "sale_submitted")
          .gte("ts", monthStart.toISOString()),
      ]);

      return {
        ...member,
        leads_count: leadsCount ?? 0,
        sales_this_month: salesCount ?? 0,
      };
    })
  );

  return NextResponse.json({ data: { team, members: enriched } });
}
