/**
 * Import FCC BDC availability CSV into Supabase fcc_att_locations table.
 *
 * Supports both FCC BDC formats:
 *   - 2024/2025 format: includes latitude/longitude columns directly
 *   - H3 format: uses h3_res8_id cell ID (converted to lat/lng centroid)
 *
 * Filters to AT&T fiber (technology code 50 = FTTP) rows only.
 *
 * Usage (run from project root):
 *   npx dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts <path-to-csv>
 *
 * Multiple files:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-fcc-bdc.ts LA.csv TX.csv OK.csv
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
  address_primary: string | null;
  city: string | null;
  state_abbr: string;
  zip: string | null;
  max_down_mbps: number;
  max_up_mbps: number;
}

async function upsertBatch(rows: FccRow[]) {
  const records = rows.map((r) => ({
    location_id: r.location_id,
    lat: r.lat,
    lng: r.lng,
    address_primary: r.address_primary,
    city: r.city,
    state_abbr: r.state_abbr,
    zip: r.zip,
    max_down_mbps: r.max_down_mbps,
    max_up_mbps: r.max_up_mbps,
    technology: 50,
  }));

  const { error } = await supabase
    .from("fcc_att_locations")
    .upsert(records, { onConflict: "location_id" });

  if (error) {
    console.error("\nBatch error:", error.message);
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
  let hasLatLng = false;

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headers = line.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      hasLatLng = headers.includes("latitude") && headers.includes("longitude");
      console.log(`Columns: ${headers.join(", ")}`);
      console.log(`Format: ${hasLatLng ? "lat/lng direct" : "H3 cell ID"}`);
      continue;
    }

    // Handle quoted CSV fields
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

    const brand = (row["brand_name"] ?? "").toLowerCase();
    const tech = parseInt(row["technology"] ?? "0", 10);

    // AT&T fiber only (tech 50 = FTTP)
    if ((!brand.includes("at&t") && !brand.includes("att")) || tech !== 50) {
      skipped++;
      continue;
    }

    let lat: number, lng: number;

    if (hasLatLng) {
      lat = parseFloat(row["latitude"] ?? "");
      lng = parseFloat(row["longitude"] ?? "");
      if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }
    } else {
      const h3Index = row["h3_res8_id"] ?? "";
      if (!h3Index) { skipped++; continue; }
      try {
        [lat, lng] = cellToLatLng(h3Index);
      } catch {
        skipped++;
        continue;
      }
    }

    const locationId = row["location_id"] ?? row["h3_res8_id"] ?? `${lat},${lng}`;
    if (!locationId) { skipped++; continue; }

    batch.push({
      location_id: locationId,
      lat,
      lng,
      address_primary: row["address_primary"] || null,
      city: row["city"] || null,
      state_abbr: row["state_usps"] ?? "",
      zip: row["zip_code"] ?? row["zip"] ?? null,
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

  console.log(`\n  Done: ${total.toLocaleString()} AT&T fiber locations inserted, ${skipped.toLocaleString()} rows skipped.`);
}

// Parse a CSV line handling quoted fields with commas inside
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  for (const f of csvFiles) {
    await importFile(f);
  }
  console.log("\nAll files imported.");
}

main().catch((err) => { console.error(err); process.exit(1); });
