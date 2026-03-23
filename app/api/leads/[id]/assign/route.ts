import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assign_to } = await request.json();
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("leads")
    .select("org_id, assigned_to")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data, error } = await admin
    .from("leads")
    .update({ assigned_to: assign_to ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log
  await admin.from("sales_activity_log").insert({
    org_id: lead.org_id,
    lead_id: id,
    actor_id: user.id,
    event_type: assign_to ? "lead_assigned" : "lead_unassigned",
    summary: assign_to ? `Lead assigned to rep` : "Lead unassigned",
    is_incident: false,
  });

  return NextResponse.json({ data });
}
