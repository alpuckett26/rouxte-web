import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ id: string }> }

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // index of correct option
  explanation: string;
}

const QUESTION_COUNT = 5;
const PASS_THRESHOLD = 4; // 4/5 = 80%

// POST /api/training/[id]/quiz
// body: {} → generate quiz
// body: { answers, questions } → grade quiz
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: doc } = await admin.from("training_documents").select("title, content").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = await request.json();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Generate quiz ──────────────────────────────────────────────────────────
  if (!body.answers) {
    const prompt = `You are a training quiz generator for a door-to-door fiber sales team. Based on this training document, generate exactly ${QUESTION_COUNT} multiple-choice quiz questions to test understanding.

Document title: ${doc.title}
Document content:
${doc.content.slice(0, 4000)}

Return ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Requirements:
- Exactly ${QUESTION_COUNT} questions
- Each question has exactly 4 options (A, B, C, D)
- Make questions practical and field-relevant — focus on techniques, scripts, and key talking points from the content
- Vary difficulty: 2 recall, 2 application, 1 scenario-based
- Explanations should reinforce the learning, not just restate the answer`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = message.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
      const parsed = JSON.parse(raw);
      return NextResponse.json({ questions: parsed.questions as QuizQuestion[] });
    } catch {
      return NextResponse.json({ error: "Failed to generate quiz. Try again." }, { status: 500 });
    }
  }

  // ── Grade quiz ─────────────────────────────────────────────────────────────
  const { answers, questions } = body as { answers: number[]; questions: QuizQuestion[] };
  const correct = answers.filter((ans, i) => ans === questions[i]?.correct).length;
  const passed = correct >= PASS_THRESHOLD;

  // Update progress
  const { data: existing } = await admin
    .from("training_progress")
    .select("id, quiz_attempts, quiz_passed")
    .eq("user_id", user.id)
    .eq("document_id", id)
    .maybeSingle();

  const attempts = (existing?.quiz_attempts ?? 0) + 1;
  const alreadyPassed = existing?.quiz_passed ?? false;

  if (existing) {
    await admin.from("training_progress").update({
      quiz_passed: alreadyPassed || passed,
      quiz_attempts: attempts,
      completed_at: passed && !alreadyPassed ? new Date().toISOString() : undefined,
    }).eq("id", existing.id);
  } else {
    const { data: profile } = await admin.from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
    await admin.from("training_progress").insert({
      user_id: user.id,
      org_id: profile?.org_id,
      document_id: id,
      started_at: new Date().toISOString(),
      completed_at: passed ? new Date().toISOString() : null,
      quiz_passed: passed,
      quiz_attempts: attempts,
    });
  }

  // ── Check promotion eligibility after a new pass ───────────────────────────
  if (passed && !alreadyPassed) {
    await admin.rpc("check_and_set_promotion_eligible", { p_user_id: user.id });
  }

  return NextResponse.json({
    correct,
    total: questions.length,
    passed,
    attempts,
    pass_threshold: PASS_THRESHOLD,
  });
}
