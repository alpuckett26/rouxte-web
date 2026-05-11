import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

// AT&T Dealer Compensation Schedule — effective 2024
// payout_amount = Total Dealer Comp (base + VIR where applicable)
const DEFAULT_PACKAGES = [
  // ── Internet: New fiber installs ──────────────────────────────────────────
  { name: "AT&T Internet 1 Gig+",           speed_mbps: 1000, payout_amount: 500, base_comp: 450, vir_incentive: 50, category: "new",       chargeback_days: 90,  display_order: 0 },
  { name: "AT&T Internet 500 Mbps",         speed_mbps: 500,  payout_amount: 450, base_comp: 400, vir_incentive: 50, category: "new",       chargeback_days: 90,  display_order: 1 },
  { name: "AT&T Internet 300 Mbps",         speed_mbps: 300,  payout_amount: 350, base_comp: 350, vir_incentive:  0, category: "new",       chargeback_days: 90,  display_order: 2 },
  { name: "AT&T Internet ≤100 Mbps",        speed_mbps: 100,  payout_amount: 160, base_comp: 160, vir_incentive:  0, category: "new",       chargeback_days: 90,  display_order: 3 },
  // ── Internet: Copper-to-fiber migrations ─────────────────────────────────
  { name: "Migration — 1 Gig+",             speed_mbps: 1000, payout_amount: 150, base_comp: 150, vir_incentive:  0, category: "migration", chargeback_days: 90,  display_order: 4 },
  { name: "Migration — 500 Mbps",           speed_mbps: 500,  payout_amount: 100, base_comp: 100, vir_incentive:  0, category: "migration", chargeback_days: 90,  display_order: 5 },
  { name: "Migration — 300 Mbps",           speed_mbps: 300,  payout_amount: 75,  base_comp: 75,  vir_incentive:  0, category: "migration", chargeback_days: 90,  display_order: 6 },
  // ── Mobility: New voice lines (Installment Plan) ──────────────────────────
  // Base new voice add = $150. Common plan bonuses stack on top.
  { name: "Mobile — New Line (Unlimited Starter)", speed_mbps: null, payout_amount: 150, base_comp: 150, vir_incentive: 0, category: "mobility", chargeback_days: 90,  display_order: 7 },
  { name: "Mobile — New Line (Unlimited Extra)",   speed_mbps: null, payout_amount: 175, base_comp: 175, vir_incentive: 0, category: "mobility", chargeback_days: 90,  display_order: 8 },
  { name: "Mobile — New Line (Unlimited Premium)", speed_mbps: null, payout_amount: 185, base_comp: 185, vir_incentive: 0, category: "mobility", chargeback_days: 90,  display_order: 9 },
  { name: "Mobile — New Line BYOD",               speed_mbps: null, payout_amount: 150, base_comp: 150, vir_incentive: 0, category: "mobility", chargeback_days: 180, display_order: 10 },
  // ── Mobile Insurance ──────────────────────────────────────────────────────
  { name: "Mobile Insurance — Single (ProTech + Protect)",  speed_mbps: null, payout_amount: 15, base_comp: 15, vir_incentive: 0, category: "insurance", chargeback_days: 90, display_order: 11 },
  { name: "Mobile Insurance — Family 4 (ProTech + Protect)",speed_mbps: null, payout_amount: 50, base_comp: 50, vir_incentive: 0, category: "insurance", chargeback_days: 90, display_order: 12 },
];

async function getOrgAndRole(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

// GET /api/packages — list active packages for org (seeds defaults if none exist)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrgAndRole(user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const admin = createAdminClient();

  // Seed defaults if org has no packages
  const { data: existing } = await admin
    .from("packages")
    .select("id").eq("org_id", profile.org_id).limit(1);

  if (!existing?.length) {
    await admin.from("packages").insert(
      DEFAULT_PACKAGES.map((p) => ({ ...p, org_id: profile.org_id }))
    );
  }

  const { data, error } = await admin
    .from("packages")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("active", true)
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/packages — create a package (manager+)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrgAndRole(user.id);
  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, speed_mbps, payout_amount, display_order } = body;
  if (!name?.trim() || payout_amount == null) {
    return NextResponse.json({ error: "name and payout_amount are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("packages")
    .insert({ org_id: profile.org_id, name: name.trim(), speed_mbps: speed_mbps ?? null, payout_amount, display_order: display_order ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
