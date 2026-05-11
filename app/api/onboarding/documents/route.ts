import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_DOC_TYPES, DOCUMENT_FORM_DEFS } from "@/lib/onboarding/documentForms";

/**
 * GET /api/onboarding/documents
 * Returns required document templates for the user's org + their submission status.
 * Seeds default templates if the org has none yet.
 */
export async function GET() {
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

  // Seed default templates if org has none
  const { data: existing } = await admin
    .from("onboarding_document_templates")
    .select("id")
    .eq("org_id", profile.org_id)
    .limit(1);

  if (!existing?.length) {
    await admin.from("onboarding_document_templates").insert(
      DEFAULT_DOC_TYPES.map((docType, i) => ({
        org_id: profile.org_id,
        doc_type: docType,
        title: DOCUMENT_FORM_DEFS[docType].title,
        required: DOCUMENT_FORM_DEFS[docType].defaultRequired,
        display_order: i,
      }))
    );
  }

  // Fetch required templates
  const { data: templates, error } = await admin
    .from("onboarding_document_templates")
    .select("*")
    .eq("org_id", profile.org_id)
    .eq("required", true)
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch user's submissions
  const templateIds = (templates ?? []).map((t) => t.id);
  const { data: submissions } = await admin
    .from("onboarding_document_submissions")
    .select("template_id, signed_at")
    .eq("user_id", user.id)
    .in("template_id", templateIds.length ? templateIds : ["00000000-0000-0000-0000-000000000000"]);

  const submittedIds = new Set((submissions ?? []).map((s) => s.template_id));

  const result = (templates ?? []).map((t) => ({
    ...t,
    submitted: submittedIds.has(t.id),
  }));

  return NextResponse.json({ data: result });
}
