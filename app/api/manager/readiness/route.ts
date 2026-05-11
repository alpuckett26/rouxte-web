import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch items (global + org-specific)
  const { data: items } = await admin
    .from("readiness_items")
    .select("*")
    .or(`org_id.is.null,org_id.eq.${profile.org_id}`)
    .eq("active", true)
    .order("order_index");

  // Fetch reps in this org (team leads only see their team)
  let repQuery = admin
    .from("user_profiles")
    .select("user_id, full_name, role, team_id")
    .eq("org_id", profile.org_id)
    .in("role", ["sales_rep", "team_lead"])
    .order("full_name");

  if (profile.role === "team_lead") {
    repQuery = repQuery.eq("team_id", profile.team_id);
  }

  const { data: reps } = await repQuery;

  // Fetch all checks for this org
  const { data: checks } = await admin
    .from("readiness_checks")
    .select("user_id, item_id, checked_at, checked_by, notes")
    .eq("org_id", profile.org_id);

  // Build a lookup: user_id -> Set of item_ids checked
  const checkMap: Record<string, Record<string, { checked_at: string; notes: string | null }>> = {};
  for (const c of checks ?? []) {
    if (!checkMap[c.user_id]) checkMap[c.user_id] = {};
    checkMap[c.user_id][c.item_id] = { checked_at: c.checked_at, notes: c.notes };
  }

  const data = (reps ?? []).map((rep) => ({
    ...rep,
    checks: checkMap[rep.user_id] ?? {},
    completed: Object.keys(checkMap[rep.user_id] ?? {}).length,
    total: items?.length ?? 0,
  }));

  return NextResponse.json({ data, items: items ?? [] });
}

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

  const { user_id, item_id, checked, notes } = await request.json();

  if (checked) {
    const { error } = await admin.from("readiness_checks").upsert({
      org_id: profile.org_id,
      user_id,
      item_id,
      checked_by: user.id,
      checked_at: new Date().toISOString(),
      notes: notes ?? null,
    }, { onConflict: "user_id,item_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    await admin.from("readiness_checks")
      .delete()
      .eq("user_id", user_id)
      .eq("item_id", item_id)
      .eq("org_id", profile.org_id);
  }

  return NextResponse.json({ ok: true });
}
