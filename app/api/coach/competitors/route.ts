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
    .from("competitor_intel")
    .select("*")
    .or(`org_id.is.null,org_id.eq.${profile?.org_id}`)
    .eq("active", true)
    .order("competitor")
    .order("monthly_price");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { data, error } = await admin.from("competitor_intel").insert({
    org_id: profile.org_id,
    competitor: body.competitor?.trim(),
    plan_name: body.plan_name?.trim(),
    monthly_price: body.monthly_price ?? null,
    download_mbps: body.download_mbps ?? null,
    upload_mbps: body.upload_mbps ?? null,
    contract_required: body.contract_required ?? false,
    data_cap_gb: body.data_cap_gb ?? null,
    notes: body.notes?.trim() || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
