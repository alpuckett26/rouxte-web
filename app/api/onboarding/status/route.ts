import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, full_name, onboarding_step, onboarding_complete, field_cleared, field_cleared_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Readiness items + this rep's checks
  const { data: items } = await admin
    .from("readiness_items")
    .select("id, label, description, category, order_index")
    .or(`org_id.is.null,org_id.eq.${profile.org_id}`)
    .eq("active", true)
    .order("order_index");

  const { data: checks } = await admin
    .from("readiness_checks")
    .select("item_id, checked_at")
    .eq("user_id", user.id)
    .eq("org_id", profile.org_id);

  const checkedIds = new Set((checks ?? []).map((c) => c.item_id));

  // Training progress
  const { data: modules } = await admin
    .from("training_documents")
    .select("id, title, sequence_order")
    .eq("folder", "training")
    .order("sequence_order");

  const { data: progress } = await admin
    .from("training_progress")
    .select("document_id, completed_at, quiz_passed, quiz_attempts")
    .eq("user_id", user.id);

  const progressMap: Record<string, { completed_at: string | null; quiz_passed: boolean }> = {};
  for (const p of progress ?? []) {
    progressMap[p.document_id] = { completed_at: p.completed_at, quiz_passed: p.quiz_passed };
  }

  // Shadow sessions
  const { data: shadows } = await admin
    .from("shadow_sessions")
    .select("id, session_date, duration_hrs, mentor_id, notes, manager_approved")
    .eq("rep_id", user.id)
    .eq("org_id", profile.org_id)
    .order("session_date", { ascending: false });

  const mentorIds = [...new Set((shadows ?? []).map((s) => s.mentor_id))];
  const { data: mentorProfiles } = mentorIds.length
    ? await admin.from("user_profiles").select("user_id, full_name").in("user_id", mentorIds)
    : { data: [] };
  const mentorMap: Record<string, string> = {};
  for (const m of mentorProfiles ?? []) mentorMap[m.user_id] = m.full_name;

  const readinessItems = (items ?? []).map((item) => ({
    ...item,
    checked: checkedIds.has(item.id),
  }));
  const readinessCompleted = readinessItems.filter((i) => i.checked).length;

  const trainingModules = (modules ?? []).map((mod) => ({
    ...mod,
    ...(progressMap[mod.id] ?? { completed_at: null, quiz_passed: false }),
  }));
  const trainingCompleted = trainingModules.filter((m) => m.quiz_passed).length;

  return NextResponse.json({
    profile: {
      full_name: profile.full_name,
      onboarding_complete: profile.onboarding_complete,
      field_cleared: profile.field_cleared,
      field_cleared_at: profile.field_cleared_at,
    },
    readiness: {
      items: readinessItems,
      completed: readinessCompleted,
      total: readinessItems.length,
    },
    training: {
      modules: trainingModules,
      completed: trainingCompleted,
      total: trainingModules.length,
    },
    shadows: (shadows ?? []).map((s) => ({
      ...s,
      mentor_name: mentorMap[s.mentor_id] ?? "Unknown",
    })),
  });
}
