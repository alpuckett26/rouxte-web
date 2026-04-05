import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PACKAGES = [
  { name: "1 Gig Fiber",   speed_mbps: 1000, payout_amount: 500, display_order: 0 },
  { name: "500 Mbps Fiber", speed_mbps: 500,  payout_amount: 450, display_order: 1 },
  { name: "300 Mbps Fiber", speed_mbps: 300,  payout_amount: 350, display_order: 2 },
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
