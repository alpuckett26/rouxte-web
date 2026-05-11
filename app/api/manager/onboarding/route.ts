import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/manager/onboarding
 * Returns all org members with their onboarding stage and document completion.
 * Accessible to team_lead and above.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile || callerProfile.role === "sales_rep") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all members
  const { data: members, error } = await admin
    .from("user_profiles")
    .select("user_id, full_name, role, onboarding_step, onboarding_complete, team_id, created_at")
    .eq("org_id", callerProfile.org_id)
    .order("onboarding_complete")          // incomplete first
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get required template count for org
  const { count: totalRequired } = await admin
    .from("onboarding_document_templates")
    .select("id", { count: "exact", head: true })
    .eq("org_id", callerProfile.org_id)
    .eq("required", true);

  // Get submission counts per user
  const userIds = (members ?? []).map((m) => m.user_id);
  let submissionCounts: Record<string, number> = {};

  if (userIds.length && (totalRequired ?? 0) > 0) {
    const { data: subs } = await admin
      .from("onboarding_document_submissions")
      .select("user_id")
      .eq("org_id", callerProfile.org_id)
      .in("user_id", userIds);

    for (const sub of subs ?? []) {
      submissionCounts[sub.user_id] = (submissionCounts[sub.user_id] ?? 0) + 1;
    }
  }

  const result = (members ?? []).map((m) => ({
    ...m,
    docs_submitted: submissionCounts[m.user_id] ?? 0,
    docs_required: totalRequired ?? 0,
  }));

  return NextResponse.json({ data: result });
}
