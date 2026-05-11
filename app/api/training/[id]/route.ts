import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ id: string }> }

// GET /api/training/[id] — get doc content + user's progress
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: doc }, { data: progress }] = await Promise.all([
    admin.from("training_documents").select("*").eq("id", id).maybeSingle(),
    admin.from("training_progress").select("*").eq("user_id", user.id).eq("document_id", id).maybeSingle(),
  ]);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as started if not already
  if (!progress) {
    const { data: profile } = await admin.from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
    await admin.from("training_progress").insert({
      user_id: user.id,
      org_id: profile?.org_id,
      document_id: id,
      started_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ data: doc, progress: progress ?? null });
}
