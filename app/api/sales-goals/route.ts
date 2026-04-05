import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/sales-goals — list active goals visible to the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role, team_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  let query = admin
    .from("sales_goals")
    .select("*, assigner:assigned_by(full_name:user_profiles!assigned_by(full_name))")
    .eq("org_id", profile.org_id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("created_at", { ascending: false });

  // Reps only see their own goals; managers see all
  if (profile.role === "sales_rep") {
    query = query.or(`user_id.eq.${user.id},team_id.eq.${profile.team_id ?? "00000000-0000-0000-0000-000000000000"}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/sales-goals — create a goal (team_lead+)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();

  if (!profile || profile.role === "sales_rep") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    user_id, team_id, period_type, min_sales_count,
    min_revenue, team_lead_bonus, effective_from, effective_to,
  } = body;

  if (!period_type || (!user_id && !team_id)) {
    return NextResponse.json({ error: "period_type and either user_id or team_id are required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("sales_goals")
    .insert({
      org_id: profile.org_id,
      user_id: user_id ?? null,
      team_id: team_id ?? null,
      period_type,
      min_sales_count: min_sales_count ?? 0,
      min_revenue: min_revenue ?? null,
      team_lead_bonus: team_lead_bonus ?? null,
      assigned_by: user.id,
      effective_from: effective_from ?? new Date().toISOString().split("T")[0],
      effective_to: effective_to ?? null,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
