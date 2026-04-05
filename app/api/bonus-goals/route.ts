import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/bonus-goals — list active bonus goals for org
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data, error } = await admin
    .from("bonus_goals")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/bonus-goals — create a bonus goal
export async function POST(request: NextRequest) {
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
  const { name, bonus_amount, target_sales_count, target_revenue, period_type, active } = body;

  if (!name || !bonus_amount) {
    return NextResponse.json({ error: "name and bonus_amount are required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("bonus_goals")
    .insert({
      org_id: profile.org_id,
      name,
      bonus_amount,
      target_sales_count: target_sales_count ?? null,
      target_revenue: target_revenue ?? null,
      period_type: period_type ?? "weekly",
      active: active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/bonus-goals — toggle active or update a goal
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
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data, error } = await admin
    .from("bonus_goals")
    .update(updates)
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
