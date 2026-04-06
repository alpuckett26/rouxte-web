import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const repId = request.nextUrl.searchParams.get("rep_id");

  let query = admin
    .from("shadow_sessions")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("session_date", { ascending: false });

  if (repId) query = query.eq("rep_id", repId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with names
  const userIds = [...new Set([
    ...(data ?? []).map((s) => s.rep_id),
    ...(data ?? []).map((s) => s.mentor_id),
  ])];

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) nameMap[p.user_id] = p.full_name;

  const enriched = (data ?? []).map((s) => ({
    ...s,
    rep_name: nameMap[s.rep_id] ?? "Unknown",
    mentor_name: nameMap[s.mentor_id] ?? "Unknown",
  }));

  return NextResponse.json({ data: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.rep_id || !body.mentor_id || !body.session_date) {
    return NextResponse.json({ error: "rep_id, mentor_id, and session_date are required" }, { status: 400 });
  }

  const { data, error } = await admin.from("shadow_sessions").insert({
    org_id: profile.org_id,
    rep_id: body.rep_id,
    mentor_id: body.mentor_id,
    session_date: body.session_date,
    duration_hrs: body.duration_hrs ?? null,
    notes: body.notes?.trim() || null,
    logged_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
