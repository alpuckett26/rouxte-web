import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!["admin", "sales_manager", "team_lead"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [funnelsResult, submissionsResult, profilesResult] = await Promise.all([
    admin.from("lead_funnels").select("*").eq("org_id", profile.org_id),
    admin
      .from("funnel_submissions")
      .select("rep_id, lead_temperature, created_at")
      .eq("org_id", profile.org_id),
    admin
      .from("user_profiles")
      .select("user_id, full_name")
      .eq("org_id", profile.org_id),
  ]);

  const funnels = funnelsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const profiles = profilesResult.data ?? [];

  const nameMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));

  const data = funnels.map(f => {
    const subs = submissions.filter(s => s.rep_id === f.rep_id);
    const lastSub = subs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      rep_id:             f.rep_id,
      full_name:          nameMap[f.rep_id] ?? "Unknown",
      slug:               f.slug,
      funnel_name:        f.funnel_name,
      active:             f.active,
      scan_count:         f.scan_count,
      total_submissions:  subs.length,
      hot_count:          subs.filter(s => s.lead_temperature === "hot").length,
      warm_count:         subs.filter(s => s.lead_temperature === "warm").length,
      cold_count:         subs.filter(s => s.lead_temperature === "cold").length,
      last_submission_at: lastSub?.created_at ?? null,
    };
  }).sort((a, b) => b.hot_count - a.hot_count || b.total_submissions - a.total_submissions);

  return NextResponse.json({ data });
}
