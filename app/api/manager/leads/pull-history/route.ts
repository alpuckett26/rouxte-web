import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/manager/leads/pull-history
 * Returns recent lead_pulled + lead_auto_pulled activity log entries for the org,
 * enriched with rep names. Used by the manager leads tracker page.
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  // Pull history from activity log
  const { data: logs } = await admin
    .from("sales_activity_log")
    .select("id, lead_id, actor_id, event_type, summary, metadata, ts")
    .eq("org_id", profile.org_id)
    .in("event_type", ["lead_pulled", "lead_auto_pulled"])
    .order("ts", { ascending: false })
    .limit(limit);

  // Lead work activity summary — per rep
  const { data: repStats } = await admin
    .from("leads")
    .select("assigned_to, status, assigned_at, cooldown_until, pull_reason, pulled_at")
    .eq("org_id", profile.org_id);

  // Aggregate per-rep stats
  type RepStat = {
    user_id: string;
    full_name: string;
    total: number;
    worked: number;
    worked_pct: number;
    in_cooldown: number;
    oldest_age_days: number | null;
  };

  const repMap: Record<string, { total: number; worked: number; in_cooldown: number; oldest_assigned_at: string | null }> = {};
  for (const lead of repStats ?? []) {
    if (!lead.assigned_to) continue;
    if (!repMap[lead.assigned_to]) {
      repMap[lead.assigned_to] = { total: 0, worked: 0, in_cooldown: 0, oldest_assigned_at: null };
    }
    repMap[lead.assigned_to].total++;
    if (lead.status !== "new") repMap[lead.assigned_to].worked++;
    if (lead.assigned_at) {
      const prev = repMap[lead.assigned_to].oldest_assigned_at;
      if (!prev || lead.assigned_at < prev) {
        repMap[lead.assigned_to].oldest_assigned_at = lead.assigned_at;
      }
    }
  }

  // Count leads in cooldown (pulled from any rep)
  const cooldownCount = (repStats ?? []).filter(
    (l) => l.cooldown_until && new Date(l.cooldown_until) > new Date()
  ).length;

  // Load rep names
  const repIds = Object.keys(repMap);
  const { data: profiles } = repIds.length
    ? await admin.from("user_profiles").select("user_id, full_name").in("user_id", repIds)
    : { data: [] };

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) nameMap[p.user_id] = p.full_name;

  const repActivity: RepStat[] = Object.entries(repMap).map(([userId, s]) => ({
    user_id:         userId,
    full_name:       nameMap[userId] ?? "Unknown",
    total:           s.total,
    worked:          s.worked,
    worked_pct:      s.total > 0 ? Math.round(s.worked * 100 / s.total) : 0,
    in_cooldown:     0, // calculated separately below
    oldest_age_days: s.oldest_assigned_at
      ? Math.floor((Date.now() - new Date(s.oldest_assigned_at).getTime()) / 86_400_000)
      : null,
  }));

  return NextResponse.json({
    data: {
      pull_log:      logs ?? [],
      rep_activity:  repActivity,
      cooldown_total: cooldownCount,
    },
  });
}
