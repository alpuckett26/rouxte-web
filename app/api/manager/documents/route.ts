import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const { data, error } = await admin
    .from("org_documents")
    .select("id, name, description, category, file_path, file_size, mime_type, created_at, uploaded_by")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs (1 hour)
  const docs = await Promise.all((data ?? []).map(async (doc) => {
    const { data: signed } = await admin.storage
      .from("org-documents")
      .createSignedUrl(doc.file_path, 3600);
    return { ...doc, url: signed?.signedUrl ?? null };
  }));

  return NextResponse.json({ documents: docs });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  if (!["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const category = (formData.get("category") as string | null) ?? "other";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (file.size > 52_428_800) return NextResponse.json({ error: "File too large (50 MB max)" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "bin";
  const filePath = `${profile.org_id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("org-documents")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await admin.from("org_documents").insert({
    org_id:      profile.org_id,
    uploaded_by: user.id,
    name,
    description,
    category,
    file_path:   filePath,
    file_size:   file.size,
    mime_type:   file.type,
  }).select().single();

  if (error) {
    await admin.storage.from("org-documents").remove([filePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
