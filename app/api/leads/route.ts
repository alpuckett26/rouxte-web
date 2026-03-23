import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LeadStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const carrier = searchParams.get("carrier");
  const status = searchParams.get("status") as LeadStatus | null;
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const isDNK = searchParams.get("is_do_not_knock");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("page_size") ?? "50"), 100);

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (isDNK !== null) query = query.eq("is_do_not_knock", isDNK === "true");
  if (carrier === "att") query = query.eq("carrier_availability->att", true);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, page_size: pageSize });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...body,
      org_id: profile.org_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-log
  await supabase.from("sales_activity_log").insert({
    org_id: profile.org_id,
    lead_id: data.id,
    actor_id: user.id,
    event_type: "lead_assigned",
    summary: `Lead created at ${data.address}`,
    is_incident: false,
  });

  return NextResponse.json({ data }, { status: 201 });
}
