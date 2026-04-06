/**
 * Downloads training docs from Supabase Storage, extracts text with mammoth,
 * and seeds the training_documents table with content + sequence order.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/extract-training-content.ts
 */

import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "training-docs";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Sequence order for the guided training flow
const SEQUENCE: Record<string, number> = {
  "Training Doc Attire.docx": 1,
  "Training Doc Training Videos.docx": 2,
  "Training Doc 2.docx": 3,
  "Training Doc 3 (D2D Psych).docx": 4,
  "Training Doc 5.docx": 5,
  "Training Doc 6 (FOMO).docx": 6,
  "Training Doc 7.docx": 7,
  "Training Doc 8 (Concept Yes).docx": 8,
  "Training Doc 9 Behavior.docx": 9,
  "Training Doc 10 Rebuttal.docx": 10,
  "Training Doc 11 Fiber Pros.docx": 11,
  "Training Doc 12 InDepth Pros.docx": 12,
  "Training Doc 13 Customer Cues.docx": 13,
  "Training Doc 14 Think About It.docx": 14,
  "Training Doc 15 NoTime.docx": 15,
  "Training Doc 16 Closing.docx": 16,
  "Training Doc 17 ATT Rebuttals.docx": 17,
  "Training Doc 18 Cable vs Fiber.docx": 18,
  "Training Doc 20 Fiber vs 5G internet.docx": 19,
  "Training Doc 21 Latency.docx": 20,
  "Training Doc 22 Price Comparison.docx": 21,
  "Training Doc Schedule.docx": 22,
  "Training Doc 1 week Classroom Training Itinerary.docx": 23,
};

function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.docx$/i, "")
    .replace(/^Training Doc\s*/i, "")
    .replace(/^\d+\s*[-.]?\s*/, "")
    .trim();
}

async function processFolder(folder: string) {
  const { data: files, error } = await supabase.storage.from(BUCKET).list(folder);
  if (error || !files) { console.error(`Failed to list ${folder}:`, error); return; }

  for (const file of files.filter((f) => f.name.endsWith(".docx"))) {
    const storagePath = `${folder}/${file.name}`;
    console.log(`  Processing: ${file.name}`);

    // Download
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath);
    if (dlErr || !blob) { console.log(`    ✗ Download failed: ${dlErr?.message}`); continue; }

    // Extract text
    let content = "";
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      content = result.value.trim();
    } catch (e) {
      console.log(`    ✗ Extraction failed: ${e}`);
      continue;
    }

    if (!content) { console.log(`    ✗ No content extracted`); continue; }

    const title = folder === "training"
      ? cleanTitle(file.name)
      : file.name.replace(/\.docx$/i, "");

    const sequenceOrder = SEQUENCE[file.name] ?? null;

    // Upsert into training_documents
    const { error: dbErr } = await supabase
      .from("training_documents")
      .upsert(
        { storage_path: storagePath, title, folder, content, sequence_order: sequenceOrder },
        { onConflict: "storage_path" }
      );

    if (dbErr) {
      console.log(`    ✗ DB error: ${dbErr.message}`);
    } else {
      console.log(`    ✓ ${title} (${content.length} chars, seq: ${sequenceOrder ?? "none"})`);
    }
  }
}

async function main() {
  console.log("Extracting training content...\n");
  console.log("Training modules:");
  await processFolder("training");
  console.log("\nContracts:");
  await processFolder("contracts");
  console.log("\nDone. Training content is ready for AI coach.");
}

main().catch((err) => { console.error(err); process.exit(1); });
