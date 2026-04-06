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

// POST /api/training/[id]/quiz
// body: { answers?: number[] } — if provided, grade the quiz; if not, generate it
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
    const prompt = `You are a training quiz generator. Based on this training document, generate exactly 3 multiple-choice quiz questions to test understanding.

Document title: ${doc.title}
Document content:
${doc.content.slice(0, 3000)}

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

Make questions practical and field-relevant. Focus on techniques and specific talking points from the content.`;

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
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
  const passed = correct >= 2; // 2/3 to pass

  // Update progress
  const { data: existing } = await admin
    .from("training_progress")
    .select("id, quiz_attempts, quiz_passed")
    .eq("user_id", user.id)
    .eq("document_id", id)
    .maybeSingle();

  const attempts = (existing?.quiz_attempts ?? 0) + 1;

  if (existing) {
    await admin.from("training_progress").update({
      quiz_passed: existing.quiz_passed || passed,
      quiz_attempts: attempts,
      completed_at: passed && !existing.quiz_passed ? new Date().toISOString() : undefined,
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

  return NextResponse.json({ correct, total: questions.length, passed, attempts });
}
