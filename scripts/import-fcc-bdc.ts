/**
 * Import FCC BDC availability CSV into Supabase fcc_att_locations table.
 * Supports the 2025 FCC format which uses H3 hex cell IDs (no lat/lng in file).
 *
 * Usage (run from project root):
 *   npx dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts <path-to-csv>
 *
 * Multiple files:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts file1.csv file2.csv
 *
 * Filters to AT&T fiber (technology=50) rows only.
 * Converts h3_res8_id → lat/lng centroid using h3-js.
 * Search radius in fcc_att_available() should be ~400m to account for H3 cell size.
 */

import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";
import { cellToLatLng } from "h3-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Run with: npx dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts <csv>");
  process.exit(1);
}

const csvFiles = process.argv.slice(2);
if (!csvFiles.length) {
  console.error("Usage: npx tsx scripts/import-fcc-bdc.ts <csv> [csv2] ...");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface FccRow {
  location_id: string;
  lat: number;
  lng: number;
  state: string;
  max_down_mbps: number;
  max_up_mbps: number;
}

async function upsertBatch(rows: FccRow[]) {
  const records = rows.map((r) => ({
    location_id: r.location_id,
    geom: `SRID=4326;POINT(${r.lng} ${r.lat})`,
    state: r.state,
    max_down_mbps: r.max_down_mbps,
    max_up_mbps: r.max_up_mbps,
    tech_code: 50,
  }));

  const { error } = await supabase.rpc("upsert_fcc_locations", { rows: records });
  if (error) {
    // Fallback: insert one by one via SQL
    for (const r of rows) {
      await supabase.from("fcc_att_locations").upsert({
        geom: `POINT(${r.lng} ${r.lat})`,
        state: r.state,
        max_down_mbps: r.max_down_mbps,
        max_up_mbps: r.max_up_mbps,
        tech_code: 50,
      });
    }
  }
}

async function importFile(csvPath: string) {
  const absolutePath = path.resolve(csvPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    return;
  }

  console.log(`\nImporting: ${path.basename(absolutePath)}`);

  const rl = createInterface({
    input: fs.createReadStream(absolutePath),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let batch: FccRow[] = [];
  let total = 0;
  let skipped = 0;
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = line.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      console.log("Columns:", headers.join(", "));
      continue;
    }

    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

    const brand = (row["brand_name"] ?? "").toLowerCase();
    const tech = parseInt(row["technology"] ?? "0", 10);

    // AT&T fiber only (tech 50)
    if (!brand.includes("at&t") || tech !== 50) { skipped++; continue; }

    const h3Index = row["h3_res8_id"] ?? "";
    if (!h3Index) { skipped++; continue; }

    // Convert H3 cell centroid → lat/lng
    let lat: number, lng: number;
    try {
      [lat, lng] = cellToLatLng(h3Index);
    } catch {
      skipped++;
      continue;
    }

    batch.push({
      location_id: row["location_id"] ?? h3Index,
      lat,
      lng,
      state: row["state_usps"] ?? "",
      max_down_mbps: parseInt(row["max_advertised_download_speed"] ?? "0", 10),
      max_up_mbps: parseInt(row["max_advertised_upload_speed"] ?? "0", 10),
    });

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      total += batch.length;
      batch = [];
      process.stdout.write(`\r  ${total.toLocaleString()} inserted, ${skipped.toLocaleString()} skipped…`);
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch);
    total += batch.length;
  }

  console.log(`\n  Done: ${total.toLocaleString()} AT&T fiber cells inserted, ${skipped.toLocaleString()} skipped.`);
}

async function main() {
  for (const f of csvFiles) {
    await importFile(f);
  }
  console.log("\nAll files imported.");
}

main().catch((err) => { console.error(err); process.exit(1); });
