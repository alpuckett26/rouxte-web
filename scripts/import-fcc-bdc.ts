/**
 * Import FCC BDC availability CSV into Supabase fcc_att_locations table.
 *
 * Usage:
 *   npx tsx scripts/import-fcc-bdc.ts <path-to-csv>
 *
 * Where to get the CSV:
 *   1. Go to https://broadbandmap.fcc.gov/data-download/availability-data
 *   2. Select your state → "Availability" → Download
 *   3. Unzip the file, you'll get a CSV named like:
 *      bdc_TX_Fixed_Broadband_2024December_V1.csv
 *
 * The script filters to AT&T fiber rows only (brand_name contains "AT&T",
 * technology = 50) and upserts them in batches of 500.
 *
 * AT&T technology codes in BDC data:
 *   50 = Fiber to the Premises (FTTP)
 *   40 = Cable (not AT&T fiber, skip)
 *   300 = LTE (skip)
 */

import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("Run with: dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts <csv>");
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npx tsx scripts/import-fcc-bdc.ts <path-to-bdc-csv>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface BdcRow {
  location_id: string;
  lat: number;
  lng: number;
  address_primary: string;
  city: string;
  state_abbr: string;
  zip: string;
  max_down_mbps: number;
  max_up_mbps: number;
  technology: number;
}

async function upsertBatch(rows: BdcRow[]) {
  const { error } = await supabase
    .from("fcc_att_locations")
    .upsert(rows, { onConflict: "location_id" });
  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

async function main() {
  const absolutePath = path.resolve(csvPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Reading: ${absolutePath}`);

  const rl = createInterface({
    input: fs.createReadStream(absolutePath),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let batch: BdcRow[] = [];
  let total = 0;
  let skipped = 0;
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      // Parse header row — BDC CSVs use lowercase snake_case column names
      headers = line.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      console.log("Columns:", headers.slice(0, 10).join(", "), "...");
      continue;
    }

    // Parse CSV row (simple split — BDC data doesn't embed commas in fields)
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

    const brand = (row["brand_name"] ?? "").toLowerCase();
    const tech = parseInt(row["technology"] ?? "0", 10);

    // Keep only AT&T fiber (tech 50) rows
    if (!brand.includes("at&t") || tech !== 50) {
      skipped++;
      continue;
    }

    const lat = parseFloat(row["latitude"] ?? "0");
    const lng = parseFloat(row["longitude"] ?? "0");
    if (!lat || !lng) { skipped++; continue; }

    batch.push({
      location_id: row["location_id"],
      lat,
      lng,
      address_primary: row["address_primary"] ?? "",
      city: row["city"] ?? "",
      state_abbr: row["state_abbr"] ?? "",
      zip: row["zip"] ?? "",
      max_down_mbps: parseInt(row["max_advertised_download_speed"] ?? "0", 10),
      max_up_mbps: parseInt(row["max_advertised_upload_speed"] ?? "0", 10),
      technology: tech,
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      total += batch.length;
      batch = [];
      process.stdout.write(`\rInserted ${total.toLocaleString()} rows…`);
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch);
    total += batch.length;
  }

  console.log(`\nDone. Inserted ${total.toLocaleString()} AT&T fiber locations. Skipped ${skipped.toLocaleString()} non-AT&T/non-fiber rows.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
