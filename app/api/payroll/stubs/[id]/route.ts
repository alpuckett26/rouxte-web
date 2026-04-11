import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { paystubReleasedEmail } from "@/lib/email/templates";

interface Params { params: Promise<{ id: string }> }

// GET /api/payroll/stubs/[id] — full stub with line items
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const isManager = ["admin", "sales_manager", "team_lead"].includes(profile.role);

  const { data: stub } = await admin
    .from("paystubs")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!stub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isManager && (stub.user_id !== user.id || stub.status !== "released")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Attach rep name
  const { data: repProfile } = await admin
    .from("user_profiles").select("full_name, hourly_rate, sales_tier_id").eq("user_id", stub.user_id).maybeSingle();

  return NextResponse.json({ data: { ...stub, full_name: repProfile?.full_name ?? "" } });
}

// PATCH /api/payroll/stubs/[id] — manager updates hours, notes, or status
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: stub } = await admin
    .from("paystubs").select("*").eq("id", id).eq("org_id", profile.org_id).maybeSingle();
  if (!stub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Hours update (hourly reps) — recalculate net pay
  if (body.hours_worked !== undefined) {
    const hours = Number(body.hours_worked);
    const rate = stub.hourly_rate ?? 0;
    const hourlyGross = hours * rate;
    updates.hours_worked = hours;
    // Update line item for hours
    const items = (stub.line_items as Array<{ type: string; hours?: number; gross?: number }>) ?? [];
    const hoursItem = items.find((i) => i.type === "hours");
    if (hoursItem) { hoursItem.hours = hours; hoursItem.gross = hourlyGross; }
    updates.line_items = items;
    updates.net_pay = Math.max(0, hourlyGross + stub.bonus - stub.chargebacks);
  }

  if (body.manager_notes !== undefined) updates.manager_notes = body.manager_notes;

  if (body.status === "approved" && stub.status === "pending_approval") {
    updates.status = "approved";
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
  }

  if (body.status === "released" && stub.status === "approved") {
    updates.status = "released";
    updates.released_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("paystubs").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email rep when their stub is released
  if (updates.status === "released") {
    const { data: { user: repUser } } = await admin.auth.admin.getUserById(stub.user_id);
    const { data: repProfile } = await admin
      .from("user_profiles").select("full_name").eq("user_id", stub.user_id).maybeSingle();
    if (repUser?.email) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com";
      const tpl = paystubReleasedEmail({
        repName:     repProfile?.full_name ?? repUser.email,
        periodLabel: stub.period_label ?? `${stub.period_start} – ${stub.period_end}`,
        netPay:      data?.net_pay ?? stub.net_pay,
        viewUrl:     `${origin}/payroll/stubs/${id}/print`,
      });
      await sendEmail({ from: FROM, to: repUser.email, ...tpl });
    }
  }

  return NextResponse.json({ data });
}
