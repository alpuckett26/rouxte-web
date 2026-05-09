import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const QUESTION_COUNT = 5;

// Three different angles so variants test different aspects of the same material.
// Running the same prompt three times would yield too-similar output.
const VARIANT_ANGLES = [
  `Focus on core concepts: key facts, definitions, and the "why" behind each technique.`,
  `Focus on real-world field application: door-step scenarios, customer reactions, and roleplay situations.`,
  `Focus on specific scripts, word-for-word language, objection handling, and closing techniques.`,
] as const;

/**
 * POST /api/admin/training/generate-quizzes
 * Admin/manager only. Generates and stores 3 quiz variants for each training module.
 *
 * Body:
 *   document_ids  string[]?  — specific modules (omit to generate for ALL modules missing variants)
 *   force         boolean?   — regenerate even if quiz_variants already exist
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden — admin/manager only" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const docIds: string[] | undefined = body.document_ids;
  const force: boolean = body.force === true;

  // Fetch training documents
  let docsQuery = admin
    .from("training_documents")
    .select("id, title, content")
    .eq("folder", "training")
    .order("sequence_order");
  if (docIds?.length) {
    docsQuery = docsQuery.in("id", docIds);
  }
  const { data: docs } = await docsQuery;
  if (!docs?.length) return NextResponse.json({ error: "No training documents found" }, { status: 404 });

  // Only skip modules that already have all 3 variants (unless force=true)
  const { data: existingQuizzes } = await admin
    .from("training_quizzes")
    .select("document_id, quiz_variants")
    .in("document_id", docs.map((d) => d.id));

  const alreadyHasVariants = new Set(
    (existingQuizzes ?? [])
      .filter((q) => Array.isArray(q.quiz_variants) && q.quiz_variants.length >= 3)
      .map((q) => q.document_id)
  );

  const toGenerate = force
    ? docs
    : docs.filter((d) => !alreadyHasVariants.has(d.id));

  if (!toGenerate.length) {
    return NextResponse.json({
      ok: true,
      message: "All modules already have 3 quiz variants. Pass force: true to regenerate.",
      generated: 0,
      skipped: docs.length,
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const results: Array<{ document_id: string; title: string; status: "ok" | "error"; error?: string }> = [];

  for (const doc of toGenerate) {
    try {
      const contentSnippet = doc.content.slice(0, 4000);

      // Generate all 3 variants; run sequentially to avoid hitting rate limits
      const variants: Array<Array<{ question: string; options: string[]; correct: number; explanation: string }>> = [];

      for (const angle of VARIANT_ANGLES) {
        const prompt = `You are a training quiz generator for a door-to-door fiber sales team. Based on this training document, generate exactly ${QUESTION_COUNT} multiple-choice quiz questions to test understanding.

${angle}

Document title: ${doc.title}
Document content:
${contentSnippet}

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
- Make questions practical and field-relevant — focus on techniques, scripts, and key talking points
- Vary difficulty within each set: 2 recall, 2 application, 1 scenario-based
- Explanations reinforce learning (shown to reps after they submit)
- Do NOT repeat questions that would obviously appear in other variants of this quiz`;

        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");
        const parsed = JSON.parse(raw);
        variants.push(parsed.questions);
      }

      // Upsert: questions = variant[0] for backwards compatibility; quiz_variants = all 3
      await admin.from("training_quizzes").upsert(
        {
          document_id:   doc.id,
          org_id:        profile.org_id,
          questions:     variants[0],
          quiz_variants: variants,
          generated_at:  new Date().toISOString(),
          generated_by:  user.id,
        },
        { onConflict: "document_id" }
      );

      results.push({ document_id: doc.id, title: doc.title, status: "ok" });
    } catch (err) {
      results.push({
        document_id: doc.id,
        title:       doc.title,
        status:      "error",
        error:       err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const generated = results.filter((r) => r.status === "ok").length;
  const failed    = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    ok:        failed === 0,
    generated,
    skipped:   docs.length - toGenerate.length,
    failed,
    results,
  });
}
