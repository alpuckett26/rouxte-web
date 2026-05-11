import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All training modules in order
  const { data: modules } = await admin
    .from("training_documents")
    .select("id, title, sequence_order, folder")
    .eq("folder", "training")
    .order("sequence_order");

  // All reps in org (team leads only see their team)
  let repQuery = admin
    .from("user_profiles")
    .select("user_id, full_name, role, team_id, field_cleared, promotion_eligible, promotion_eligible_at")
    .eq("org_id", profile.org_id)
    .in("role", ["sales_rep", "team_lead"])
    .order("full_name");

  if (profile.role === "team_lead") {
    repQuery = repQuery.eq("team_id", profile.team_id);
  }

  const { data: reps } = await repQuery;

  // All training progress in org
  const repIds = (reps ?? []).map((r) => r.user_id);
  const { data: progress } = repIds.length
    ? await admin
        .from("training_progress")
        .select("user_id, document_id, completed_at, quiz_passed, quiz_attempts")
        .in("user_id", repIds)
    : { data: [] };

  // Build lookup: user_id -> { document_id -> progress }
  const progressMap: Record<string, Record<string, { completed_at: string | null; quiz_passed: boolean; quiz_attempts: number }>> = {};
  for (const p of progress ?? []) {
    if (!progressMap[p.user_id]) progressMap[p.user_id] = {};
    progressMap[p.user_id][p.document_id] = {
      completed_at: p.completed_at,
      quiz_passed: p.quiz_passed,
      quiz_attempts: p.quiz_attempts,
    };
  }

  const data = (reps ?? []).map((rep) => {
    const repProgress = progressMap[rep.user_id] ?? {};
    const moduleStatus = (modules ?? []).map((mod) => ({
      module_id: mod.id,
      title: mod.title,
      sequence_order: mod.sequence_order,
      ...(repProgress[mod.id] ?? { completed_at: null, quiz_passed: false, quiz_attempts: 0 }),
    }));
    const completed = moduleStatus.filter((m) => m.quiz_passed).length;
    return {
      ...rep,
      modules: moduleStatus,
      completed,
      total: modules?.length ?? 0,
      pct: modules?.length ? Math.round((completed / modules.length) * 100) : 0,
    };
  });

  return NextResponse.json({ data, modules: modules ?? [] });
}
