import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/payroll/stubs
// Reps: their own released stubs
// Managers: all stubs in org (any status)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const isManager = ["admin", "sales_manager", "team_lead"].includes(profile.role);

  let query = admin
    .from("paystubs")
    .select("id, user_id, period_start, period_end, pay_type, hours_worked, hourly_rate, gross_commission, chargebacks, bonus, net_pay, sales_count, status, approved_at, released_at, manager_notes")
    .eq("org_id", profile.org_id)
    .order("period_start", { ascending: false });

  if (!isManager) {
    query = query.eq("user_id", user.id).eq("status", "released");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach rep names for manager view
  if (isManager && data?.length) {
    const userIds = [...new Set(data.map((s) => s.user_id))];
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const nameMap: Record<string, string> = Object.fromEntries(
      (profiles ?? []).map((p) => [p.user_id, p.full_name])
    );
    return NextResponse.json({ data: data.map((s) => ({ ...s, full_name: nameMap[s.user_id] ?? "" })) });
  }

  return NextResponse.json({ data });
}
