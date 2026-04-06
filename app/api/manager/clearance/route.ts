import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { rep_id, cleared } = await request.json();
  if (!rep_id) return NextResponse.json({ error: "rep_id required" }, { status: 400 });

  const { error } = await admin.from("user_profiles")
    .update({
      field_cleared: cleared ?? true,
      field_cleared_by: cleared !== false ? user.id : null,
      field_cleared_at: cleared !== false ? new Date().toISOString() : null,
    })
    .eq("user_id", rep_id)
    .eq("org_id", profile.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to activity log
  await admin.from("sales_activity_log").insert({
    org_id: profile.org_id,
    user_id: user.id,
    event_type: "manager_acknowledged",
    notes: cleared !== false
      ? `Cleared ${rep_id} to work in the field`
      : `Revoked field clearance for ${rep_id}`,
  }).select();

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role, field_cleared, field_cleared_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    field_cleared: profile.field_cleared,
    field_cleared_at: profile.field_cleared_at,
  });
}
