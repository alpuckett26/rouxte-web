import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { onboardingCompleteRepEmail, onboardingCompleteManagerEmail } from "@/lib/email/templates";

/**
 * POST /api/onboarding/documents/complete
 * Verifies all required documents are signed, then marks onboarding complete.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Get all required templates
  const { data: required } = await admin
    .from("onboarding_document_templates")
    .select("id")
    .eq("org_id", profile.org_id)
    .eq("required", true);

  const requiredIds = (required ?? []).map((t) => t.id);

  if (requiredIds.length > 0) {
    // Check all are submitted
    const { count } = await admin
      .from("onboarding_document_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("template_id", requiredIds);

    if ((count ?? 0) < requiredIds.length) {
      return NextResponse.json(
        { error: "Not all required documents have been signed", completed: count, total: requiredIds.length },
        { status: 422 }
      );
    }
  }

  // Mark onboarding complete
  const { error } = await admin
    .from("user_profiles")
    .update({
      onboarding_step: "complete",
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify rep + a manager in the org
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com";
  const { data: repProfile } = await admin
    .from("user_profiles").select("full_name, org_id").eq("user_id", user.id).maybeSingle();
  const { data: { user: repUser } } = await admin.auth.admin.getUserById(user.id);
  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).maybeSingle();
  const orgName = org?.name ?? "your org";
  const repName = repProfile?.full_name ?? repUser?.email?.split("@")[0] ?? "Rep";

  if (repUser?.email) {
    await sendEmail({ from: FROM, to: repUser.email,
      ...onboardingCompleteRepEmail({ repName, orgName, dashUrl: `${origin}/dashboard` }) });
  }

  // Find a manager/admin in the org to notify
  const { data: managers } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("org_id", profile.org_id)
    .in("role", ["admin", "sales_manager"])
    .limit(3);

  for (const mgr of managers ?? []) {
    const { data: { user: mgrUser } } = await admin.auth.admin.getUserById(mgr.user_id);
    if (mgrUser?.email) {
      await sendEmail({ from: FROM, to: mgrUser.email,
        ...onboardingCompleteManagerEmail({
          repName, repEmail: repUser?.email ?? "", orgName,
          dashUrl: `${origin}/manager`,
        }) });
    }
  }

  return NextResponse.json({ ok: true });
}
