import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireManager(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("org_id, role, team_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !["admin", "sales_manager"].includes(data.role)) return null;
  return data;
}

// GET /api/manager/teams — all teams in org with member count + this-month sales
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await requireManager(user.id);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Scope: admins see all teams in the org; sales_managers see only their
  // own team (one-team-per-user model — multi-team-per-manager is a future
  // schema enhancement).
  let teamsQuery = admin
    .from("teams")
    .select("id, name, tier, created_at")
    .eq("org_id", profile.org_id)
    .order("name");
  if (profile.role === "sales_manager") {
    if (!profile.team_id) {
      return NextResponse.json({ data: [] });
    }
    teamsQuery = teamsQuery.eq("id", profile.team_id);
  }
  const { data: teams, error } = await teamsQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each team: member count, leads count, sales this month
  const enriched = await Promise.all(
    (teams ?? []).map(async (team) => {
      const [{ count: memberCount }, { count: leadsCount }, { count: salesCount }] =
        await Promise.all([
          admin
            .from("user_profiles")
            .select("user_id", { count: "exact", head: true })
            .eq("team_id", team.id),
          admin
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("org_id", profile.org_id)
            .not("assigned_to", "is", null),
          admin
            .from("sales_activity_log")
            .select("id", { count: "exact", head: true })
            .eq("team_id", team.id)
            .eq("event_type", "sale_submitted")
            .gte("ts", monthStart.toISOString()),
        ]);

      return {
        ...team,
        member_count: memberCount ?? 0,
        leads_count: leadsCount ?? 0,
        sales_this_month: salesCount ?? 0,
      };
    })
  );

  return NextResponse.json({ data: enriched });
}

// POST /api/manager/teams — create a new team
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await requireManager(user.id);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name: string = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .insert({ org_id: profile.org_id, name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
