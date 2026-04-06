/**
 * Imports AT&T Fiber AI coach rebuttals from Excel into coach_qa.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/import-coach-rebuttals.ts path/to/file.xlsx
 *
 * Requires SEED_ORG_ID in .env.local (run: select id from orgs limit 5; in Supabase)
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ORG_ID            = process.env.SEED_ORG_ID!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ORG_ID) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ORG_ID");
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/import-coach-rebuttals.ts path/to/file.xlsx");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Map Excel objection_category → coach_qa category
function mapCategory(objectionCategory: string, softCloseType: string): string {
  const cat = (objectionCategory ?? "").toLowerCase();
  const close = (softCloseType ?? "").toLowerCase();

  if (close.includes("close") && !cat.includes("price") && !cat.includes("afford")) return "closing";
  if (cat.includes("price") || cat.includes("afford") || cat.includes("discount") || cat.includes("promo")) return "objection";
  if (cat.includes("pitch") || cat.includes("bundle") || cat.includes("family")) return "pitch";
  return "objection";
}

async function main() {
  const absPath = path.resolve(filePath);
  console.log(`Reading: ${absPath}\n`);

  const wb = XLSX.readFile(absPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  console.log(`Found ${rows.length} rows\n`);

  // Check existing to avoid duplicates
  const { data: existing } = await supabase
    .from("coach_qa")
    .select("trigger")
    .eq("org_id", ORG_ID);

  const existingTriggers = new Set(
    (existing ?? []).map((e: { trigger: string }) => e.trigger.toLowerCase().trim())
  );

  const toInsert: {
    org_id: string;
    trigger: string;
    response: string;
    category: string;
  }[] = [];

  const skipped: string[] = [];

  for (const row of rows) {
    const trigger  = (row["customer_objection"] ?? "").trim();
    const rebuttal = (row["rebuttal"] ?? "").trim();
    const followUp = (row["follow_up_question"] ?? "").trim();
    const coachNote = (row["coach_note"] ?? "").trim();
    const objCat   = row["objection_category"] ?? "";
    const closeType = row["soft_close_type"] ?? "";

    if (!trigger || !rebuttal) { skipped.push(`Row missing trigger or rebuttal`); continue; }
    if (existingTriggers.has(trigger.toLowerCase())) { skipped.push(`Duplicate: "${trigger.slice(0, 40)}…"`); continue; }

    // Build full response: rebuttal + follow-up question + coach note
    let response = rebuttal;
    if (followUp) response += `\n\nFollow up: "${followUp}"`;
    if (coachNote) response += `\n\n[Coach tip: ${coachNote}]`;

    toInsert.push({
      org_id: ORG_ID,
      trigger,
      response,
      category: mapCategory(objCat, closeType),
    });
  }

  console.log(`Inserting ${toInsert.length} new rebuttals (${skipped.length} skipped)\n`);

  if (!toInsert.length) {
    console.log("Nothing to insert.");
    return;
  }

  // Insert in batches of 50
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const { error } = await supabase.from("coach_qa").insert(batch);
    if (error) {
      console.error(`Batch ${Math.floor(i / 50) + 1} error:`, error.message);
    } else {
      console.log(`Inserted batch ${Math.floor(i / 50) + 1} (${batch.length} rows)`);
    }
  }

  // Summary by category
  const byCat: Record<string, number> = {};
  toInsert.forEach((r) => { byCat[r.category] = (byCat[r.category] ?? 0) + 1; });
  console.log("\nBy category:");
  Object.entries(byCat).forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
  console.log("\nDone.");
}

main();
