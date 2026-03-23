import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isIncident } from "@/lib/utils/logs";
import { LogEventType } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");
  const team_id = searchParams.get("team_id");
  const user_id = searchParams.get("user_id");
  const event_type = searchParams.get("event_type") as LogEventType | null;
  const incidents_only = searchParams.get("incidents_only") === "true";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("page_size") ?? "50"), 100);

  let query = supabase
    .from("sales_activity_log")
    .select("*, signoffs:sales_activity_signoffs(*)", { count: "exact" })
    .order("ts", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (lead_id) query = query.eq("lead_id", lead_id);
  if (team_id) query = query.eq("team_id", team_id);
  if (user_id) query = query.eq("actor_id", user_id);
  if (event_type) query = query.eq("event_type", event_type);
  if (incidents_only) query = query.eq("is_incident", true);
  if (from) query = query.gte("ts", from);
  if (to) query = query.lte("ts", to);

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
    .select("org_id, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json();
  const { event_type, summary, lead_id, metadata, amends_log_id } = body;

  if (!event_type || !summary) {
    return NextResponse.json({ error: "event_type and summary are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sales_activity_log")
    .insert({
      org_id: profile.org_id,
      lead_id: lead_id ?? null,
      actor_id: user.id,
      team_id: profile.team_id ?? null,
      event_type,
      summary,
      metadata: metadata ?? {},
      amends_log_id: amends_log_id ?? null,
      is_incident: isIncident(event_type as LogEventType),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
