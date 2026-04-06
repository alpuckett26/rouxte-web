import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/leads/bulk-assign
// Body: { lead_ids: string[], assign_to: string | null }
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
  const assignTo: string | null = body.assign_to ?? null;

  if (!leadIds.length) return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
  if (leadIds.length > 1000) return NextResponse.json({ error: "Max 1000 leads per bulk assign" }, { status: 400 });

  // Verify all leads belong to this org
  const { data: leads } = await admin
    .from("leads")
    .select("id")
    .eq("org_id", profile.org_id)
    .in("id", leadIds);

  const validIds = (leads ?? []).map((l) => l.id);
  if (!validIds.length) return NextResponse.json({ error: "No valid leads found" }, { status: 404 });

  const { error } = await admin
    .from("leads")
    .update({ assigned_to: assignTo, updated_at: new Date().toISOString() })
    .in("id", validIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log
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

  return NextResponse.json({ assigned: validIds.length });
}
