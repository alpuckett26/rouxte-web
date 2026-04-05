import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ templateId: string }> }

/**
 * POST /api/onboarding/documents/[templateId]/submit
 * Body: { form_data: Record<string, unknown>, signed_name: string }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { templateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const signedName: string = body.signed_name?.trim();
  if (!signedName) {
    return NextResponse.json({ error: "Signature (signed_name) is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify template belongs to user's org
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data: template } = await admin
    .from("onboarding_document_templates")
    .select("id, doc_type, org_id")
    .eq("id", templateId)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data, error } = await admin
    .from("onboarding_document_submissions")
    .upsert(
      {
        org_id: profile.org_id,
        user_id: user.id,
        template_id: templateId,
        doc_type: template.doc_type,
        form_data: body.form_data ?? {},
        signature_name: signedName,
        signed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,template_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
