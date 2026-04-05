import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function periodStart(periodType: "weekly" | "monthly"): string {
  const now = new Date();
  if (periodType === "weekly") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// GET /api/manager/goals — all reps with their active goal + current period progress
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();

  if (!callerProfile || callerProfile.role === "sales_rep") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];

  // All org members
  const { data: members } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role, team_id, sales_tier_id, standing")
    .eq("org_id", callerProfile.org_id)
    .order("full_name");

  // All active goals
  const { data: goals } = await admin
    .from("sales_goals")
    .select("*")
    .eq("org_id", callerProfile.org_id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`);

  // Current period sales counts per user (monthly as default for overview)
  const monthStart = periodStart("monthly");
  const { data: saleLogs } = await admin
    .from("sales_activity_log")
    .select("actor_id, metadata")
    .eq("org_id", callerProfile.org_id)
    .eq("event_type", "sale_submitted")
    .gte("ts", monthStart);

  // Build per-user sale count + revenue maps
  const salesByUser: Record<string, { count: number; revenue: number }> = {};
  for (const log of saleLogs ?? []) {
    if (!salesByUser[log.actor_id]) salesByUser[log.actor_id] = { count: 0, revenue: 0 };
    salesByUser[log.actor_id].count++;
    salesByUser[log.actor_id].revenue += Number(log.metadata?.payout_amount) || 0;
  }

  const result = (members ?? []).map((member) => {
    const goal = (goals ?? []).find((g) => g.user_id === member.user_id) ??
                 (goals ?? []).find((g) => g.team_id === member.team_id) ?? null;

    const progress = salesByUser[member.user_id] ?? { count: 0, revenue: 0 };
    const goalMet = goal
      ? progress.count >= goal.min_sales_count &&
        (!goal.min_revenue || progress.revenue >= goal.min_revenue)
      : null;

    const pctOfGoal = goal?.min_sales_count > 0
      ? Math.min(100, Math.round((progress.count / goal.min_sales_count) * 100))
      : null;

    return { ...member, goal, progress, goal_met: goalMet, pct_of_goal: pctOfGoal };
  });

  // Sort: at-risk (lowest pct) first, then no-goal, then met
  result.sort((a, b) => {
    if (a.pct_of_goal === null && b.pct_of_goal === null) return 0;
    if (a.pct_of_goal === null) return 1;
    if (b.pct_of_goal === null) return -1;
    return (a.pct_of_goal ?? 0) - (b.pct_of_goal ?? 0);
  });

  return NextResponse.json({ data: result });
}
