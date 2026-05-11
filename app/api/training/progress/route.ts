import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: docs }, { data: progress }] = await Promise.all([
    admin.from("training_documents")
      .select("id, title, folder, sequence_order, content")
      .eq("folder", "training")
      .order("sequence_order"),
    admin.from("training_progress")
      .select("document_id, started_at, completed_at, quiz_passed, quiz_attempts")
      .eq("user_id", user.id),
  ]);

  const progressMap = Object.fromEntries((progress ?? []).map((p) => [p.document_id, p]));

  const modules = (docs ?? []).map((doc) => ({
    ...doc,
    content: undefined, // don't send full content in list
    content_length: doc.content?.length ?? 0,
    progress: progressMap[doc.id] ?? null,
  }));

  const completed = modules.filter((m) => m.progress?.quiz_passed).length;

  return NextResponse.json({ data: modules, completed, total: modules.length });
}
