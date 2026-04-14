import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/manager/leads/rep-leads?rep_id=<uuid>
 * Returns all leads currently assigned to the given rep, grouped by status,
 * including worked-% stats needed by the pull modal.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repId = searchParams.get("rep_id");
  if (!repId) return NextResponse.json({ error: "rep_id is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify rep is in same org
  const { data: repProfile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", repId)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!repProfile) {
    return NextResponse.json({ error: "Rep not found in org" }, { status: 404 });
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id, address, status, assigned_at, appointment_at, customer_name")
    .eq("org_id", profile.org_id)
    .eq("assigned_to", repId)
    .order("assigned_at", { ascending: true });

  const allLeads = leads ?? [];
  const worked   = allLeads.filter((l) => l.status !== "new");
  const workedPct = allLeads.length > 0 ? Math.round(worked.length * 100 / allLeads.length) : 0;

  // Age of oldest unworked lead
  const unworked = allLeads.filter((l) => l.status === "new" && l.assigned_at);
  const oldestUnworkedAt = unworked.length > 0
    ? unworked.reduce((oldest, l) =>
        l.assigned_at! < oldest ? l.assigned_at! : oldest,
        unworked[0].assigned_at!
      )
    : null;

  const oldestAgeDays = oldestUnworkedAt
    ? Math.floor((Date.now() - new Date(oldestUnworkedAt).getTime()) / 86_400_000)
    : null;

  return NextResponse.json({
    data: {
      rep_id:          repId,
      rep_name:        repProfile.full_name,
      total:           allLeads.length,
      worked:          worked.length,
      worked_pct:      workedPct,
      oldest_age_days: oldestAgeDays,
      leads:           allLeads,
    },
  });
}
