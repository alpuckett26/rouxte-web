import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reason } = await request.json();

  const { data: lead } = await supabase
    .from("leads")
    .select("org_id, address")
    .eq("id", id)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Mark lead as DNK
  await supabase
    .from("leads")
    .update({ is_do_not_knock: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  // Store in opt_out_addresses
  await supabase.from("opt_out_addresses").upsert({
    org_id: lead.org_id,
    normalized_address: lead.address.toLowerCase().trim(),
    lead_id: id,
    source: "manual",
    created_by: user.id,
  }, { onConflict: "org_id,normalized_address" });

  // Auto-log as incident
  await supabase.from("sales_activity_log").insert({
    org_id: lead.org_id,
    lead_id: id,
    actor_id: user.id,
    event_type: "do_not_knock_marked",
    summary: reason || "Address marked as Do Not Knock",
    is_incident: true,
  });

  return NextResponse.json({ ok: true });
}
