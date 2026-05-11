import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/manager/my-team
// Returns the caller's team (for team leads) with members + per-member stats.
// Also accessible to sales_manager/admin (returns their assigned team).
export async function GET() {
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
  if (!profile.team_id) {
    return NextResponse.json({ data: null, message: "Not assigned to a team" });
  }

  // Get team info
  const { data: team } = await admin
    .from("teams")
    .select("id, name, tier")
    .eq("id", profile.team_id)
    .maybeSingle();

  if (!team) return NextResponse.json({ data: null, message: "Team not found" });

  // Get all members of this team
  const { data: members } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role, created_at")
    .eq("team_id", profile.team_id)
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
