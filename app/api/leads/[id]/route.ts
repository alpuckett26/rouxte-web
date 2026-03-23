import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Fetch current lead for status comparison
  const { data: current } = await supabase
    .from("leads")
    .select("status, org_id")
    .eq("id", id)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("leads")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log status change
  if (body.status && body.status !== current.status) {
    await supabase.from("lead_status_history").insert({
      lead_id: id,
      from_status: current.status,
      to_status: body.status,
      changed_by: user.id,
    });

    await supabase.from("sales_activity_log").insert({
      org_id: current.org_id,
      lead_id: id,
      actor_id: user.id,
      event_type: "status_changed",
      summary: `Status changed from ${current.status} to ${body.status}`,
      metadata: { from: current.status, to: body.status },
      is_incident: false,
    });
  }

  return NextResponse.json({ data });
}
