import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

// Keywords that identify rebuttal/script training docs
const SCRIPT_KEYWORDS = [
  "rebuttal", "think about it", "notime", "no time", "closing",
  "att rebuttals", "cable vs fiber", "fiber vs 5g", "price comparison",
  "fomo", "concept yes", "psych", "behavior", "objection",
];

function getCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("closing")) return "closing";
  if (t.includes("fomo") || t.includes("concept yes") || t.includes("psych")) return "pitch";
  if (t.includes("cable") || t.includes("fiber vs") || t.includes("price") || t.includes("latency")) return "product";
  return "objection";
}

async function extractQAPairs(
  title: string,
  content: string,
  category: string,
  anthropic: Anthropic
): Promise<{ trigger: string; response: string; category: string }[]> {
  const prompt = `You are extracting door-to-door sales scripts from a training document.

Document: "${title}"
Category: ${category}

Content:
${content.slice(0, 4000)}

Extract every distinct objection/trigger and its scripted response. Return ONLY a JSON array:
[{"trigger":"what the customer says or the scenario (concise)","response":"the full scripted rebuttal or pitch to use"}]

Rules:
- Only extract pairs where there is a clear scripted response (not theory)
- Trigger should be what the customer says or a short scenario label (under 15 words)
- Response should be the actual words the rep says — don't paraphrase
- Return ONLY valid JSON, no other text`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const pairs: { trigger: string; response: string }[] = JSON.parse(match[0]);
    return pairs
      .filter((p) => p.trigger?.trim() && p.response?.trim())
      .map((p) => ({ trigger: p.trigger.trim(), response: p.response.trim(), category }));
  } catch {
    return [];
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all training docs
  const { data: docs } = await admin
    .from("training_documents")
    .select("id, title, content")
    .eq("folder", "training")
    .order("sequence_order");

  if (!docs?.length) {
    return NextResponse.json({ error: "No training documents found. Run extract-training-content script first." }, { status: 400 });
  }

  // Filter to script/rebuttal docs
  const scriptDocs = docs.filter((doc) =>
    SCRIPT_KEYWORDS.some((kw) => doc.title.toLowerCase().includes(kw))
  );

  if (!scriptDocs.length) {
    // Log what titles exist to help debug
    const titles = docs.map((d) => d.title);
    return NextResponse.json({
      error: "No rebuttal/script documents matched. Check training doc titles.",
      available_titles: titles,
    }, { status: 400 });
  }

  // Check existing to avoid duplicates
  const { data: existing } = await admin
    .from("coach_qa")
    .select("trigger")
    .eq("org_id", profile.org_id);

  const existingTriggers = new Set((existing ?? []).map((e: { trigger: string }) => e.trigger.toLowerCase()));

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allPairs: { trigger: string; response: string; category: string }[] = [];

  for (const doc of scriptDocs) {
    if (!doc.content?.trim()) continue;
    const category = getCategory(doc.title);
    const pairs = await extractQAPairs(doc.title, doc.content, category, anthropic);
    allPairs.push(...pairs);
  }

  const newPairs = allPairs.filter((p) => !existingTriggers.has(p.trigger.toLowerCase()));

  if (!newPairs.length) {
    return NextResponse.json({
      inserted: 0,
      message: "All scripts already loaded.",
      docs_processed: scriptDocs.length,
    });
  }

  const rows = newPairs.map((p) => ({
    org_id: profile.org_id,
    created_by: user.id,
    trigger: p.trigger,
    response: p.response,
    category: p.category,
  }));

  const { error } = await admin.from("coach_qa").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCat: Record<string, number> = {};
  newPairs.forEach((p) => { byCat[p.category] = (byCat[p.category] ?? 0) + 1; });

  return NextResponse.json({
    inserted: newPairs.length,
    docs_processed: scriptDocs.length,
    by_category: byCat,
    message: `Loaded ${newPairs.length} scripts from ${scriptDocs.length} training documents.`,
  });
}
