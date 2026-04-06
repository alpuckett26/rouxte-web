/**
 * Uploads training documents to Supabase Storage bucket "training-docs"
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/upload-training-docs.ts
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "training-docs";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FILES = [
  // Contracts & Expectations
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Contract D2D Salesperson.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Sales Contract Team Leader.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Sales Contract Manager.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Sales Expectations Team Leader.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Sales Expectations Sales Manager.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Sales Conduct All.docx", folder: "contracts" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Interview D2D Sales Manager.docx", folder: "contracts" },

  // Training Docs
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc Attire.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc Training Videos.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 2.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 3 (D2D Psych).docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 5.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 6 (FOMO).docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 7.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 8 (Concept Yes).docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 9 Behavior.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 10 Rebuttal.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 11 Fiber Pros.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 12 InDepth Pros.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 13 Customer Cues.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 14 Think About It.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 15 NoTime.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 16 Closing.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 17 ATT Rebuttals.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 18 Cable vs Fiber.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 20 Fiber vs 5G internet.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 21 Latency.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 22 Price Comparison.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc Schedule.docx", folder: "training" },
  { path: "C:\\Users\\alpuc\\OneDrive\\Documents\\Training Doc 1 week Classroom Training Itinerary.docx", folder: "training" },
];

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`Created bucket: ${BUCKET}`);
  } else {
    console.log(`Bucket exists: ${BUCKET}`);
  }
}

async function uploadFile(filePath: string, folder: string) {
  const fileName = path.basename(filePath);
  const storagePath = `${folder}/${fileName}`;

  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ Not found: ${fileName}`);
    return;
  }

  const buffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (error) {
    console.log(`  ✗ ${fileName}: ${error.message}`);
  } else {
    console.log(`  ✓ ${storagePath}`);
  }
}

async function main() {
  await ensureBucket();
  console.log(`\nUploading ${FILES.length} files...\n`);
  for (const file of FILES) {
    await uploadFile(file.path, file.folder);
  }
  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
