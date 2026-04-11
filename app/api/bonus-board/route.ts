import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BonusWinner, BonusPeriod } from "@/lib/types/leaderboard";

// Re-export for any server-side consumers that still import from here
export type { BonusWinner, BonusPeriod };

// GET /api/bonus-board
// Returns recent pay periods with reps who earned bonuses (bonus > 0, status = released).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Last 8 released pay periods with at least one bonus winner
  const { data: stubs } = await admin
    .from("paystubs")
    .select("user_id, bonus, net_pay, sales_count, period_start, period_end, pay_period_id")
    .eq("org_id", profile.org_id)
    .eq("status", "released")
    .gt("bonus", 0)
    .order("period_end", { ascending: false })
    .limit(200);

  if (!stubs?.length) return NextResponse.json({ data: [] });

  // Unique user IDs across all stubs
  const userIds = [...new Set(stubs.map((s) => s.user_id))];

  // Fetch rep profiles (name, avatar, team)
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, full_name, avatar_url, team_id")
    .in("user_id", userIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Fetch team names
  const teamIds = [...new Set((profiles ?? []).map((p) => p.team_id).filter(Boolean))];
  const { data: teams } = teamIds.length
    ? await admin.from("teams").select("id, name").in("id", teamIds)
    : { data: [] };
  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t.name]));

  // Group by pay period
  const periodMap = new Map<string, BonusPeriod>();

  for (const stub of stubs) {
    const key = stub.pay_period_id;
    const repProfile = profileMap[stub.user_id];
    if (!repProfile) continue;

    const start = new Date(stub.period_start);
    const end   = new Date(stub.period_end);
    const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    if (!periodMap.has(key)) {
      periodMap.set(key, {
        period_label: label,
        period_start: stub.period_start,
        period_end:   stub.period_end,
        winners:      [],
      });
    }

    periodMap.get(key)!.winners.push({
      user_id:      stub.user_id,
      full_name:    repProfile.full_name,
      avatar_url:   repProfile.avatar_url ?? null,
      team_name:    repProfile.team_id ? (teamMap[repProfile.team_id] ?? null) : null,
      bonus:        stub.bonus,
      net_pay:      stub.net_pay,
      sales_count:  stub.sales_count,
      period_label: label,
      period_start: stub.period_start,
      period_end:   stub.period_end,
      is_me:        stub.user_id === user.id,
    });
  }

  // Sort winners within each period by bonus desc
  const periods = Array.from(periodMap.values())
    .sort((a, b) => b.period_end.localeCompare(a.period_end))
    .slice(0, 6) // last 6 periods
    .map((p) => ({
      ...p,
      winners: p.winners.sort((a, b) => b.bonus - a.bonus),
    }));

  return NextResponse.json({ data: periods });
}
