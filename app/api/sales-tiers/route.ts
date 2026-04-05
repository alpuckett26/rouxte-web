import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TIERS = [
  { name: "Tier 1", commission_pct: 10, display_order: 0 },
  { name: "Tier 2", commission_pct: 15, display_order: 1 },
  { name: "Tier 3", commission_pct: 20, display_order: 2 },
];

// GET /api/sales-tiers — list tiers for org (seeds defaults)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data: existing } = await admin
    .from("sales_tiers").select("id").eq("org_id", profile.org_id).limit(1);

  if (!existing?.length) {
    await admin.from("sales_tiers").insert(
      DEFAULT_TIERS.map((t) => ({ ...t, org_id: profile.org_id }))
    );
  }

  const { data, error } = await admin
    .from("sales_tiers").select("*").eq("org_id", profile.org_id).order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/sales-tiers — bulk update tier commission percentages
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();

  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  // Expect: [{ id, commission_pct, name }]
  const updates: { id: string; commission_pct: number; name?: string }[] = body.tiers ?? [];

  const results = await Promise.all(
    updates.map(({ id, commission_pct, name }) =>
      admin.from("sales_tiers")
        .update({ commission_pct, ...(name ? { name } : {}) })
        .eq("id", id)
        .eq("org_id", profile.org_id)
        .select().single()
    )
  );

  const errors = results.filter((r) => r.error);
  if (errors.length) {
    return NextResponse.json({ error: errors[0].error?.message }, { status: 500 });
  }

  return NextResponse.json({ data: results.map((r) => r.data) });
}
