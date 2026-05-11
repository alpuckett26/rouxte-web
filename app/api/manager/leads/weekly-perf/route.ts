import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/manager/leads/weekly-perf
 * Returns weekly lead-work performance per rep and per team.
 * Designed for the weekly pow-wow view.
 *
 * "Activity" is measured by status_changed + door_knock events in sales_activity_log
 * over each of the last 4 weeks. Also returns the current assignment snapshot.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now    = new Date();
  const w4ago  = new Date(now.getTime() - 28 * 86_400_000).toISOString();

  // ── Activity log: door knocks + status changes in last 4 weeks ────────────
  const { data: activityRows } = await admin
    .from("sales_activity_log")
    .select("actor_id, event_type, ts, lead_id")
    .eq("org_id", profile.org_id)
    .in("event_type", ["door_knock", "status_changed", "lead_assigned"])
    .gte("ts", w4ago)
    .order("ts", { ascending: true });

  // ── Current lead assignment snapshot ─────────────────────────────────────
  const { data: leads } = await admin
    .from("leads")
    .select("assigned_to, status, assigned_at")
    .eq("org_id", profile.org_id)
    .not("assigned_to", "is", null);

  // ── User profiles for names + team ────────────────────────────────────────
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, full_name, team_id, role")
    .eq("org_id", profile.org_id)
    .in("role", ["sales_rep", "team_lead"]);

  const { data: teams } = await admin
    .from("teams")
    .select("id, name")
    .eq("org_id", profile.org_id);

  const teamMap: Record<string, string> = {};
  for (const t of teams ?? []) teamMap[t.id] = t.name;

  const profileMap: Record<string, { full_name: string; team_id: string | null; role: string }> = {};
  for (const p of profiles ?? []) profileMap[p.user_id] = { full_name: p.full_name, team_id: p.team_id, role: p.role };

  // ── Week buckets ──────────────────────────────────────────────────────────
  // weeks[0] = current week (last 7 days), weeks[1] = prev week, etc.
  function weekBucket(ts: string): number {
    const diffMs  = now.getTime() - new Date(ts).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    return Math.min(Math.floor(diffDays / 7), 3);
  }

  // Per-rep weekly door-knock + status-change counts
  type WeekCounts = [number, number, number, number]; // weeks 0-3
  const repWeekly: Record<string, WeekCounts> = {};

  for (const row of activityRows ?? []) {
    if (!row.actor_id) continue;
    if (!repWeekly[row.actor_id]) repWeekly[row.actor_id] = [0, 0, 0, 0];
    const bucket = weekBucket(row.ts);
    repWeekly[row.actor_id][bucket]++;
  }

  // Per-rep lead snapshot (current assignment)
  const repLeadMap: Record<string, { total: number; worked: number }> = {};
  for (const lead of leads ?? []) {
    if (!lead.assigned_to) continue;
    if (!repLeadMap[lead.assigned_to]) repLeadMap[lead.assigned_to] = { total: 0, worked: 0 };
    repLeadMap[lead.assigned_to].total++;
    if (lead.status !== "new") repLeadMap[lead.assigned_to].worked++;
  }

  // Assemble rep performance rows
  const allRepIds = new Set([
    ...Object.keys(repWeekly),
    ...Object.keys(repLeadMap),
    ...(profiles ?? []).filter(p => p.role === "sales_rep").map(p => p.user_id),
  ]);

  type RepPerf = {
    user_id: string;
    full_name: string;
    team_id: string | null;
    team_name: string | null;
    assigned_total: number;
    worked: number;
    worked_pct: number;
    week_activity: WeekCounts; // [this week, last week, 2wks ago, 3wks ago]
    trend: "up" | "down" | "flat";
  };

  const repPerf: RepPerf[] = [];
  for (const uid of allRepIds) {
    const p       = profileMap[uid];
    if (!p) continue;
    const snap    = repLeadMap[uid]   ?? { total: 0, worked: 0 };
    const weekly  = repWeekly[uid]    ?? [0, 0, 0, 0];
    const trend: "up" | "down" | "flat" =
      weekly[0] > weekly[1] ? "up" :
      weekly[0] < weekly[1] ? "down" : "flat";

    repPerf.push({
      user_id:        uid,
      full_name:      p.full_name,
      team_id:        p.team_id,
      team_name:      p.team_id ? (teamMap[p.team_id] ?? null) : null,
      assigned_total: snap.total,
      worked:         snap.worked,
      worked_pct:     snap.total > 0 ? Math.round(snap.worked * 100 / snap.total) : 0,
      week_activity:  weekly,
      trend,
    });
  }

  // ── Team aggregates ───────────────────────────────────────────────────────
  type TeamPerf = {
    team_id: string;
    team_name: string;
    rep_count: number;
    assigned_total: number;
    worked: number;
    worked_pct: number;
    this_week_activity: number;
    last_week_activity: number;
    trend: "up" | "down" | "flat";
  };

  const teamAgg: Record<string, TeamPerf> = {};
  for (const rep of repPerf) {
    if (!rep.team_id || !rep.team_name) continue;
    if (!teamAgg[rep.team_id]) {
      teamAgg[rep.team_id] = {
        team_id:            rep.team_id,
        team_name:          rep.team_name,
        rep_count:          0,
        assigned_total:     0,
        worked:             0,
        worked_pct:         0,
        this_week_activity: 0,
        last_week_activity: 0,
        trend:              "flat",
      };
    }
    const t = teamAgg[rep.team_id];
    t.rep_count++;
    t.assigned_total     += rep.assigned_total;
    t.worked             += rep.worked;
    t.this_week_activity += rep.week_activity[0];
    t.last_week_activity += rep.week_activity[1];
  }
  for (const t of Object.values(teamAgg)) {
    t.worked_pct = t.assigned_total > 0 ? Math.round(t.worked * 100 / t.assigned_total) : 0;
    t.trend =
      t.this_week_activity > t.last_week_activity ? "up" :
      t.this_week_activity < t.last_week_activity ? "down" : "flat";
  }

  return NextResponse.json({
    data: {
      reps:  repPerf,
      teams: Object.values(teamAgg),
      week_labels: ["This week", "Last week", "2 weeks ago", "3 weeks ago"],
    },
  });
}
