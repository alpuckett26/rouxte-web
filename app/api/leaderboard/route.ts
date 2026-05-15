import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeaderboardEntry, Metric, Period } from "@/lib/types/leaderboard";

// Re-export for any server-side consumers that still import from here
export type { LeaderboardEntry, Metric, Period };

function periodStart(period: Period): string | null {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period  = (searchParams.get("period")  ?? "week")  as Period;
  const metric  = (searchParams.get("metric")  ?? "sales") as Metric;
  const teamId  = searchParams.get("team_id") ?? null;

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

  const since = periodStart(period);

  // All org members in scope
  // Everyone sees the full org board — it's motivational. Admins and
  // sales_managers are included too, so solo orgs (where the admin is
  // the only seller) get credit for their sales and quotes.
  // Optional ?team_id= filter still available for drill-down.
  let repQuery = admin
    .from("user_profiles")
    .select("user_id, full_name, team_id, avatar_url, role")
    .eq("org_id", profile.org_id);

  if (teamId) repQuery = repQuery.eq("team_id", teamId);

  const { data: reps } = await repQuery.order("full_name");
  if (!reps?.length) return NextResponse.json({ data: [], period, metric });

  const repIds  = reps.map((r) => r.user_id);
  const teamIds = [...new Set(reps.map((r) => r.team_id).filter(Boolean))];

  // Team names lookup
  const { data: teams } = teamIds.length
    ? await admin.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };
  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t.name]));

  // Activity log (sales / appts / doors)
  let logQuery = admin
    .from("sales_activity_log")
    .select("actor_id, event_type, lead_id")
    .eq("org_id", profile.org_id)
    .in("actor_id", repIds)
    .in("event_type", ["sale_submitted", "quote_sent", "appointment_set", "status_changed", "note_added"]);

  // Training is cumulative — don't date-filter it
  if (since && metric !== "training") logQuery = logQuery.gte("ts", since);

  const { data: logs } = await logQuery;

  // Goals
  const goalPeriod = (period === "today" || period === "week") ? "weekly" : "monthly";
  const { data: goals } = await admin
    .from("sales_goals")
    .select("user_id, min_sales_count")
    .eq("org_id", profile.org_id)
    .eq("period_type", goalPeriod)
    .in("user_id", repIds)
    .is("effective_to", null);

  const goalMap = Object.fromEntries((goals ?? []).map((g) => [g.user_id, g.min_sales_count]));

  // Training progress
  const { data: trainingDocs } = await admin
    .from("training_documents")
    .select("id", { count: "exact" })
    .eq("folder", "training");
  const totalModules = trainingDocs?.length ?? 0;

  const { data: trainingProgress } = repIds.length
    ? await admin
        .from("training_progress")
        .select("user_id, quiz_passed")
        .in("user_id", repIds)
        .eq("quiz_passed", true)
    : { data: [] };

  const trainingMap: Record<string, number> = {};
  for (const tp of trainingProgress ?? []) {
    trainingMap[tp.user_id] = (trainingMap[tp.user_id] ?? 0) + 1;
  }

  // Aggregate activity
  const counts: Record<string, { sales: number; quotes: number; appointments: number; doors: Set<string> }> = {};
  for (const rep of reps) counts[rep.user_id] = { sales: 0, quotes: 0, appointments: 0, doors: new Set() };

  for (const log of logs ?? []) {
    const c = counts[log.actor_id];
    if (!c) continue;
    if (log.event_type === "sale_submitted")       c.sales++;
    else if (log.event_type === "quote_sent")      c.quotes++;
    else if (log.event_type === "appointment_set") c.appointments++;
    else if (log.lead_id)                          c.doors.add(log.lead_id);
  }

  // Build entries
  const entries: LeaderboardEntry[] = reps.map((rep) => {
    const c               = counts[rep.user_id];
    const sales           = c.sales;
    const quotes          = c.quotes;
    const appointments    = c.appointments;
    const doors           = c.doors.size;
    const trainingModules = trainingMap[rep.user_id] ?? 0;
    const trainingPct     = totalModules ? Math.round((trainingModules / totalModules) * 100) : 0;
    const goal            = goalMap[rep.user_id] ?? null;
    const goal_pct        = goal ? Math.round((sales / goal) * 100) : null;

    return {
      rank: 0,
      user_id:          rep.user_id,
      full_name:        rep.full_name,
      avatar_url:       (rep as { avatar_url?: string | null }).avatar_url ?? null,
      team_name:        rep.team_id ? (teamMap[rep.team_id] ?? null) : null,
      sales,
      quotes,
      appointments,
      doors,
      training_pct:     trainingPct,
      training_modules: trainingModules,
      goal,
      goal_pct,
      is_me: rep.user_id === user.id,
    };
  });

  // Sort by selected metric
  const sortFn: Record<Metric, (a: LeaderboardEntry, b: LeaderboardEntry) => number> = {
    sales:        (a, b) => b.sales        - a.sales        || a.full_name.localeCompare(b.full_name),
    quotes:       (a, b) => b.quotes       - a.quotes       || a.full_name.localeCompare(b.full_name),
    appointments: (a, b) => b.appointments - a.appointments || a.full_name.localeCompare(b.full_name),
    doors:        (a, b) => b.doors        - a.doors        || a.full_name.localeCompare(b.full_name),
    training:     (a, b) => b.training_pct - a.training_pct || b.training_modules - a.training_modules || a.full_name.localeCompare(b.full_name),
  };

  entries.sort(sortFn[metric]);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return NextResponse.json({ data: entries, period, metric, total_modules: totalModules });
}
