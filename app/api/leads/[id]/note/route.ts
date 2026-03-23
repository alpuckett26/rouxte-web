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
    .from("lead_notes")
    .select("*")
    .eq("lead_id", id)
    .order("ts", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const { data: lead } = await supabase
    .from("leads")
    .select("org_id")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: id, author_id: user.id, body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log
  await supabase.from("sales_activity_log").insert({
    org_id: lead.org_id,
    lead_id: id,
    actor_id: user.id,
    event_type: "note_added",
    summary: body.slice(0, 120),
    is_incident: false,
  });

  return NextResponse.json({ data }, { status: 201 });
}
