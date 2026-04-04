import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  return NextResponse.json({ ok: true });
}
