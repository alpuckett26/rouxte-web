import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/payroll/chargebacks — unapplied chargebacks for org
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("chargebacks")
    .select("*, rep:user_id(full_name:user_profiles!user_id(full_name))")
    .eq("org_id", profile.org_id)
    .is("applied_to_stub", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/payroll/chargebacks — record a chargeback (100% of sale payout)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, lead_id, payout_amount, reason, sale_log_id } = body;

  if (!user_id || !payout_amount) {
    return NextResponse.json({ error: "user_id and payout_amount are required" }, { status: 400 });
  }

  // Decrement total_sales_count for the rep (reversal)
  const { data: rep } = await admin
    .from("user_profiles").select("total_sales_count").eq("user_id", user_id).maybeSingle();
  if (rep && rep.total_sales_count > 0) {
    await admin
      .from("user_profiles")
      .update({ total_sales_count: rep.total_sales_count - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user_id);
  }

  const { data, error } = await admin
    .from("chargebacks")
    .insert({
      org_id: profile.org_id,
      user_id,
      lead_id: lead_id ?? null,
      sale_log_id: sale_log_id ?? null,
      payout_amount,
      reason: reason ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
