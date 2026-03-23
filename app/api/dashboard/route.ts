import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id, team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Rep stats: derive from lead statuses + log counts
  const [leadsRes, incidentRes] = await Promise.all([
    supabase
      .from("leads")
      .select("status")
      .eq("assigned_to", user.id),
    supabase
      .from("sales_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("is_incident", true)
      .is("signoffs", null), // rough "no signoff" check
  ]);

  const leads = leadsRes.data ?? [];
  const contacts = leads.filter((l) => !["new", "attempted"].includes(l.status)).length;
  const appointments = leads.filter((l) =>
    ["appointment_set", "sold", "installed"].includes(l.status)
  ).length;
  const sales = leads.filter((l) => ["sold", "installed"].includes(l.status)).length;
  const doors_knocked = leads.length;
  const conversion_pct = doors_knocked > 0 ? (sales / doors_knocked) * 100 : 0;

  const rep_stats = {
    user_id: user.id,
    full_name: "",
    doors_knocked,
    contacts,
    appointments,
    sales,
    conversion_pct,
  };

  // Pending incidents count
  const { count: pendingIncidents } = await supabase
    .from("sales_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("is_incident", true)
    .eq("org_id", profile.org_id);

  // Team stats (managers only)
  let team_stats: unknown[] = [];
  if (["admin", "sales_manager", "team_lead"].includes(profile.role) && profile.team_id) {
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, user_profiles(full_name)")
      .eq("team_id", profile.team_id);

    if (members) {
      const statsPromises = members.map(async (m) => {
        const { data: mLeads } = await supabase
          .from("leads")
          .select("status")
          .eq("assigned_to", m.user_id);

        const ml = mLeads ?? [];
        const ms = ml.filter((l) => ["sold", "installed"].includes(l.status)).length;
        return {
          user_id: m.user_id,
          full_name: (m.user_profiles as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
          doors_knocked: ml.length,
          contacts: ml.filter((l) => !["new", "attempted"].includes(l.status)).length,
          appointments: ml.filter((l) => ["appointment_set", "sold", "installed"].includes(l.status)).length,
          sales: ms,
          conversion_pct: ml.length > 0 ? (ms / ml.length) * 100 : 0,
        };
      });
      team_stats = (await Promise.all(statsPromises)).sort((a, b) => b.sales - a.sales);
    }
  }

  return NextResponse.json({
    rep_stats,
    team_stats,
    pending_incidents: pendingIncidents ?? 0,
  });
}
