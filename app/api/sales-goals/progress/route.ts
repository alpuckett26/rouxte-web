import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function periodBounds(periodType: "weekly" | "monthly"): { start: string; end: string; label: string } {
  const now = new Date();
  if (periodType === "weekly") {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      start: monday.toISOString(),
      end: sunday.toISOString(),
      label: `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

// GET /api/sales-goals/progress — current period progress for the calling user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id, sales_tier_id, standing")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  // Find the most specific active goal: user-level first, then team-level
  const { data: goals } = await admin
    .from("sales_goals")
    .select("*")
    .eq("org_id", profile.org_id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .or(`user_id.eq.${user.id},team_id.eq.${profile.team_id ?? "00000000-0000-0000-0000-000000000000"}`);

  if (!goals?.length) {
    return NextResponse.json({ data: null, message: "No active goal assigned" });
  }

  // Prefer user-level goal over team goal
  const goal = goals.find((g) => g.user_id === user.id) ?? goals[0];
  const bounds = periodBounds(goal.period_type as "weekly" | "monthly");

  // Count sale_submitted events in the current period
  const { count: salesCount } = await admin
    .from("sales_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", user.id)
    .eq("event_type", "sale_submitted")
    .gte("ts", bounds.start)
    .lte("ts", bounds.end);

  // Sum revenue from package metadata
  const { data: saleLogs } = await admin
    .from("sales_activity_log")
    .select("metadata")
    .eq("actor_id", user.id)
    .eq("event_type", "sale_submitted")
    .gte("ts", bounds.start)
    .lte("ts", bounds.end);

  const revenue = (saleLogs ?? []).reduce((sum, log) => {
    return sum + (Number(log.metadata?.payout_amount) || 0);
  }, 0);

  const count = salesCount ?? 0;
  const goalMet = count >= goal.min_sales_count &&
    (!goal.min_revenue || revenue >= goal.min_revenue);

  // Days remaining in period
  const endDate = new Date(bounds.end);
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return NextResponse.json({
    data: {
      goal,
      period: { ...bounds, days_left: daysLeft },
      progress: { count, revenue, goal_met: goalMet },
      standing: profile.standing ?? "active",
    },
  });
}
