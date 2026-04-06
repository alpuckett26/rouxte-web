/**
 * Reads rebuttal/script training docs from training_documents table,
 * uses Claude to extract structured Q&A pairs, and seeds coach_qa.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/seed-coach-qa.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const ORG_ID = process.env.SEED_ORG_ID!; // Set this to your org's UUID

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_KEY || !ORG_ID) {
  console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, SEED_ORG_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// Docs that contain rebuttal/script content
const REBUTTAL_TITLES = [
  "Training Doc 10 Rebuttal",
  "Training Doc 14 Think About It",
  "Training Doc 15 NoTime",
  "Training Doc 16 Closing",
  "Training Doc 17 ATT Rebuttals",
  "Training Doc 18 Cable vs Fiber",
  "Training Doc 20 Fiber vs 5G internet",
  "Training Doc 22 Price Comparison",
  "Training Doc 6 (FOMO)",
  "Training Doc 8 (Concept Yes)",
];

// Map doc title keywords to coach_qa category
function getCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("closing")) return "closing";
  if (t.includes("fomo") || t.includes("concept yes") || t.includes("psych")) return "pitch";
  if (t.includes("cable") || t.includes("fiber vs") || t.includes("price") || t.includes("latency")) return "product";
  return "objection";
}

interface QAPair {
  trigger: string;
  response: string;
  category: string;
}

async function extractQAPairs(title: string, content: string, category: string): Promise<QAPair[]> {
  const prompt = `You are extracting sales scripts from a door-to-door sales training document.

Document title: "${title}"
Category: ${category}

Document content:
${content.slice(0, 4000)}

Extract every distinct objection/trigger and its scripted response from this document.
Format your response as a JSON array of objects with this exact shape:
[
  {
    "trigger": "what the customer says or the situation (short, 3-15 words)",
    "response": "the full scripted response the rep should use"
  }
]

Rules:
- Only include trigger/response pairs that are clearly scripted (not just explanations or theory)
- Keep triggers concise — what the customer actually says or the scenario name
- Keep responses faithful to the document — don't summarize, use the actual language
- If the document has multiple variations of a response, pick the best one
- Return ONLY valid JSON, no explanation`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`  No JSON array found in response for "${title}"`);
      return [];
    }

    const pairs: { trigger: string; response: string }[] = JSON.parse(jsonMatch[0]);
    return pairs
      .filter((p) => p.trigger?.trim() && p.response?.trim())
      .map((p) => ({
        trigger: p.trigger.trim(),
        response: p.response.trim(),
        category,
      }));
  } catch (err) {
    console.error(`  Error parsing "${title}":`, err);
    return [];
  }
}

async function main() {
  console.log("Fetching training documents from database...\n");

  const { data: docs, error } = await supabase
    .from("training_documents")
    .select("id, title, content, folder")
    .eq("folder", "training")
    .order("sequence_order");

  if (error) {
    console.error("Failed to fetch docs:", error.message);
    process.exit(1);
  }

  const rebuttalDocs = (docs ?? []).filter((doc) =>
    REBUTTAL_TITLES.some((t) => doc.title.includes(t.replace("Training Doc ", "").split(" ")[0]) ||
      REBUTTAL_TITLES.some((rt) => doc.title === rt || doc.title.startsWith(rt)))
  );

  // More precise filter
  const targetDocs = (docs ?? []).filter((doc) =>
    REBUTTAL_TITLES.some((rt) =>
      doc.title.toLowerCase().includes(rt.toLowerCase().replace("training doc ", "").replace(/\d+ ?/, "").split("(")[0].trim()) ||
      doc.title === rt
    )
  );

  const allDocs = (docs ?? []).filter((doc) =>
    REBUTTAL_TITLES.some((rt) => {
      const keyword = rt.toLowerCase().replace("training doc ", "").replace(/^\d+\s*/, "").replace(/[()]/g, "").trim();
      return doc.title.toLowerCase().includes(keyword);
    })
  );

  console.log(`Found ${allDocs.length} rebuttal/script documents to process:\n`);
  allDocs.forEach((d) => console.log(`  - ${d.title}`));
  console.log();

  if (!allDocs.length) {
    // Fall back to all docs if filter too strict
    const fallback = (docs ?? []).filter((doc) =>
      ["rebuttal", "think about it", "notime", "closing", "att rebuttals",
       "cable vs fiber", "fiber vs 5g", "price comparison", "fomo", "concept yes"].some((kw) =>
        doc.title.toLowerCase().includes(kw)
      )
    );
    console.log(`Using fallback filter, found ${fallback.length} docs`);
    allDocs.push(...fallback);
  }

  // Deduplicate
  const uniqueDocs = Array.from(new Map(allDocs.map((d) => [d.id, d])).values());

  let totalInserted = 0;
  const allPairs: QAPair[] = [];

  for (const doc of uniqueDocs) {
    if (!doc.content?.trim()) {
      console.log(`  Skipping "${doc.title}" — no content`);
      continue;
    }

    const category = getCategory(doc.title);
    console.log(`Processing "${doc.title}" (${category})...`);

    const pairs = await extractQAPairs(doc.title, doc.content, category);
    console.log(`  → Extracted ${pairs.length} Q&A pairs`);
    allPairs.push(...pairs);

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!allPairs.length) {
    console.log("\nNo pairs extracted. Check that training_documents has content.");
    return;
  }

  console.log(`\nInserting ${allPairs.length} total Q&A pairs into coach_qa for org ${ORG_ID}...`);

  // Check for existing entries to avoid duplicates
  const { data: existing } = await supabase
    .from("coach_qa")
    .select("trigger")
    .eq("org_id", ORG_ID);

  const existingTriggers = new Set((existing ?? []).map((e) => e.trigger.toLowerCase()));
  const newPairs = allPairs.filter((p) => !existingTriggers.has(p.trigger.toLowerCase()));

  console.log(`  ${allPairs.length - newPairs.length} already exist, inserting ${newPairs.length} new pairs\n`);

  if (!newPairs.length) {
    console.log("Nothing new to insert.");
    return;
  }

  const rows = newPairs.map((p) => ({
    org_id: ORG_ID,
    created_by: null,
    trigger: p.trigger,
    response: p.response,
    category: p.category,
  }));

  const { error: insertError } = await supabase.from("coach_qa").insert(rows);

  if (insertError) {
    console.error("Insert error:", insertError.message);
    process.exit(1);
  }

  console.log(`Done. Seeded ${newPairs.length} Q&A pairs into coach_qa.\n`);

  // Summary by category
  const byCat: Record<string, number> = {};
  newPairs.forEach((p) => { byCat[p.category] = (byCat[p.category] ?? 0) + 1; });
  Object.entries(byCat).forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
}

main();
