import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ id: string }> }

interface StoredQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const PASS_THRESHOLD = 4; // 4/5 = 80%

/**
 * GET /api/training/[id]/quiz
 * Returns the pre-compiled quiz questions for this module.
 * The `correct` field is STRIPPED — grading is server-side only.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: quiz } = await admin
    .from("training_quizzes")
    .select("questions")
    .eq("document_id", id)
    .maybeSingle();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not yet available for this module" }, { status: 404 });
  }

  // Strip `correct` and `explanation` — client never sees the answers
  const sanitized = (quiz.questions as StoredQuestion[]).map(({ question, options }) => ({
    question,
    options,
  }));

  return NextResponse.json({ questions: sanitized });
}

/**
 * POST /api/training/[id]/quiz
 * Body: { answers: number[] }
 * Grades against the stored quiz server-side. Returns score + pass status.
 * Explanations are included in the response AFTER grading (so reps learn from mistakes).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const answers: number[] = body.answers;

  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers array is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch stored quiz with answers (server-side only)
  const { data: quiz } = await admin
    .from("training_quizzes")
    .select("questions")
    .eq("document_id", id)
    .maybeSingle();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const questions = quiz.questions as StoredQuestion[];

  if (answers.length !== questions.length) {
    return NextResponse.json({ error: "Answer count mismatch" }, { status: 400 });
  }

  // Grade server-side
  const correct = answers.filter((ans, i) => ans === questions[i].correct).length;
  const passed  = correct >= PASS_THRESHOLD;

  // Build graded result — reveal correct answers + explanations now that quiz is submitted
  const graded = questions.map((q, i) => ({
    question:    q.question,
    options:     q.options,
    correct:     q.correct,
    explanation: q.explanation,
    user_answer: answers[i],
    is_correct:  answers[i] === q.correct,
  }));

  // Update training_progress
  const { data: existing } = await admin
    .from("training_progress")
    .select("id, quiz_attempts, quiz_passed")
    .eq("user_id", user.id)
    .eq("document_id", id)
    .maybeSingle();

  const attempts     = (existing?.quiz_attempts ?? 0) + 1;
  const alreadyPassed = existing?.quiz_passed ?? false;

  if (existing) {
    await admin.from("training_progress").update({
      quiz_passed:   alreadyPassed || passed,
      quiz_attempts: attempts,
      completed_at:  passed && !alreadyPassed ? new Date().toISOString() : undefined,
    }).eq("id", existing.id);
  } else {
    const { data: profile } = await admin
      .from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
    await admin.from("training_progress").insert({
      user_id:      user.id,
      org_id:       profile?.org_id,
      document_id:  id,
      started_at:   new Date().toISOString(),
      completed_at: passed ? new Date().toISOString() : null,
      quiz_passed:  passed,
      quiz_attempts: attempts,
    });
  }

  if (passed && !alreadyPassed) {
    await admin.rpc("check_and_set_promotion_eligible", { p_user_id: user.id });
  }

  return NextResponse.json({
    correct,
    total:          questions.length,
    passed,
    attempts,
    pass_threshold: PASS_THRESHOLD,
    graded,         // full question breakdown with explanations
  });
}
