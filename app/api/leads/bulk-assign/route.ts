import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/leads/bulk-assign
// Assign to a single rep:   { lead_ids, assign_to: userId }
// Distribute across a team: { lead_ids, team_id }
// Unassign:                 { lead_ids, assign_to: null }
export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const leadIds: string[] = body.lead_ids ?? [];
  const assignTo: string | null | undefined = body.assign_to;
  const teamId: string | undefined = body.team_id;

  if (!leadIds.length) return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
  if (leadIds.length > 2000) return NextResponse.json({ error: "Max 2000 leads per bulk assign" }, { status: 400 });

  // Verify leads belong to this org
  const { data: validLeads } = await admin
    .from("leads")
    .select("id")
    .eq("org_id", profile.org_id)
    .in("id", leadIds);

  const validIds = (validLeads ?? []).map((l) => l.id);
  if (!validIds.length) return NextResponse.json({ error: "No valid leads found" }, { status: 404 });

  // ── Team distribute mode ───────────────────────────────────────────────────
  if (teamId) {
    // Get reps on this team (must belong to same org)
    const { data: teamMembers } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("org_id", profile.org_id)
      .eq("role", "sales_rep");

    if (!teamMembers?.length) {
      return NextResponse.json({ error: "No reps on this team" }, { status: 400 });
    }

    // Load-balance: sort reps by current assigned lead count (ascending)
    const repIds = teamMembers.map((m) => m.user_id);
    const { data: existingLeads } = await admin
      .from("leads")
      .select("assigned_to")
      .eq("org_id", profile.org_id)
      .in("assigned_to", repIds)
      .not("assigned_to", "is", null);

    const loadMap: Record<string, number> = Object.fromEntries(repIds.map((id) => [id, 0]));
    for (const lead of existingLeads ?? []) {
      if (lead.assigned_to && loadMap[lead.assigned_to] !== undefined) {
        loadMap[lead.assigned_to]++;
      }
    }

    // Sort reps by load ascending (least assigned first)
    const sortedReps = [...repIds].sort((a, b) => loadMap[a] - loadMap[b]);

    // Round-robin assign, starting from least-loaded rep
    const updates: Array<{ id: string; assigned_to: string }> = [];
    for (let i = 0; i < validIds.length; i++) {
      const rep = sortedReps[i % sortedReps.length];
      updates.push({ id: validIds[i], assigned_to: rep });
    }

    // Batch update — group by rep to minimize queries
    const byRep: Record<string, string[]> = {};
    for (const u of updates) {
      if (!byRep[u.assigned_to]) byRep[u.assigned_to] = [];
      byRep[u.assigned_to].push(u.id);
    }

    for (const [repId, ids] of Object.entries(byRep)) {
      await admin
        .from("leads")
        .update({ assigned_to: repId, updated_at: new Date().toISOString() })
        .in("id", ids);
    }

    // Activity log
    await admin.from("sales_activity_log").insert(
      validIds.map((id) => ({
        org_id: profile.org_id,
        lead_id: id,
        actor_id: user.id,
        event_type: "lead_assigned",
        summary: `Distributed to team`,
        is_incident: false,
      }))
    );

    return NextResponse.json({ assigned: validIds.length, mode: "distributed", reps: sortedReps.length });
  }

  // ── Single rep / unassign mode ─────────────────────────────────────────────
  const { error } = await admin
    .from("leads")
    .update({ assigned_to: assignTo ?? null, updated_at: new Date().toISOString() })
    .in("id", validIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("sales_activity_log").insert(
    validIds.map((id) => ({
      org_id: profile.org_id,
      lead_id: id,
      actor_id: user.id,
      event_type: assignTo ? "lead_assigned" : "lead_unassigned",
      summary: assignTo ? `Bulk assigned to rep` : "Bulk unassigned",
      is_incident: false,
    }))
  );

  return NextResponse.json({ assigned: validIds.length, mode: "single" });
}
