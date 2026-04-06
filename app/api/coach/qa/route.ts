import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();

  const { data, error } = await admin
    .from("coach_qa")
    .select("*")
    .eq("org_id", profile?.org_id)
    .eq("active", true)
    .order("category")
    .order("use_count", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.trigger?.trim() || !body.response?.trim()) {
    return NextResponse.json({ error: "trigger and response are required" }, { status: 400 });
  }

  const { data, error } = await admin.from("coach_qa").insert({
    org_id: profile.org_id,
    created_by: user.id,
    trigger: body.trigger.trim(),
    response: body.response.trim(),
    category: body.category ?? "objection",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
