import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ data: [] });

  const { data: members, error } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role, team_id")
    .eq("org_id", profile.org_id)
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch close rates for reps: assigned leads vs sold/installed
  const repIds = (members ?? []).filter((m) => m.role === "sales_rep").map((m) => m.user_id);
  const closeRateMap: Record<string, { assigned: number; closed: number }> = {};

  if (repIds.length) {
    const { data: leadStats } = await admin
      .from("leads")
      .select("assigned_to, status")
      .eq("org_id", profile.org_id)
      .in("assigned_to", repIds);

    for (const lead of leadStats ?? []) {
      if (!lead.assigned_to) continue;
      if (!closeRateMap[lead.assigned_to]) closeRateMap[lead.assigned_to] = { assigned: 0, closed: 0 };
      closeRateMap[lead.assigned_to].assigned++;
      if (lead.status === "sold" || lead.status === "installed") {
        closeRateMap[lead.assigned_to].closed++;
      }
    }
  }

  const data = (members ?? []).map((m) => {
    const stats = closeRateMap[m.user_id];
    return {
      ...m,
      assigned_leads: stats?.assigned ?? 0,
      closed_leads: stats?.closed ?? 0,
      close_rate: stats?.assigned ? Math.round((stats.closed / stats.assigned) * 100) : null,
    };
  });

  return NextResponse.json({ data });
}
