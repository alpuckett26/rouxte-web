/**
 * sync-fcc-blocks.ts
 *
 * Full pipeline: FCC BDC API → census block geometries → Supabase fcc_att_blocks
 *
 * 1. Calls FCC listAvailabilityData to find the latest Location Coverage CSV
 *    for each target state (AT&T, Fixed Broadband, tech code 50)
 * 2. Downloads and streams each CSV — extracts block_geoid where AT&T tech=50
 * 3. Groups by county, fetches block boundary polygons from Census TIGERweb
 * 4. Upserts into fcc_att_blocks table
 *
 * Prerequisites:
 *   - Migration 018 applied in Supabase
 *   - .env.local contains FCC_USERNAME, FCC_API_TOKEN,
 *     NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-fcc-blocks.ts
 *
 * Override states (2-letter codes):
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-fcc-blocks.ts TX LA
 */

import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";
import * as zlib from "zlib";

// ── Config ────────────────────────────────────────────────────────────────────
const FCC_BASE      = "https://bdc.fcc.gov";
const TIGER_BASE    = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/12/query";
const AS_OF_DATE    = "2024-06-30"; // latest public filing — update as FCC publishes new ones
const TARGET_STATES = (process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["TX", "OK", "LA", "GA"]
).map(s => s.toUpperCase());

// State abbreviation → 2-digit FIPS
const STATE_FIPS: Record<string, string> = {
  AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",
  FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",
  KY:"21",LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",
  MO:"29",MT:"30",NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",
  NC:"37",ND:"38",OH:"39",OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",
  SD:"46",TN:"47",TX:"48",UT:"49",VT:"50",VA:"51",WA:"53",WV:"54",
  WI:"55",WY:"56",
};

const FCC_USERNAME  = process.env.FCC_USERNAME!;
const FCC_TOKEN     = process.env.FCC_API_TOKEN!;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE    = 100;

if (!FCC_USERNAME || !FCC_TOKEN) {
  console.error("Missing FCC_USERNAME or FCC_API_TOKEN in .env.local");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fccHeaders = { username: FCC_USERNAME, hash_value: FCC_TOKEN };

// ── FCC API helpers ───────────────────────────────────────────────────────────
interface FccFile {
  file_id: number;
  category: string;
  subcategory: string;
  technology_type: string;
  technology_code: string;
  state_fips: string;
  state_name: string;
  provider_id: string;
  provider_name: string;
  file_type: string;
  file_name: string;
  record_count: string;
}

async function listAvailabilityFiles(asOfDate: string): Promise<FccFile[]> {
  const url = `${FCC_BASE}/api/public/map/downloads/listAvailabilityData/${asOfDate}` +
    `?category=State&subcategory=Location%20Coverage&technology_type=Fixed%20Broadband`;
  const resp = await fetch(url, { headers: fccHeaders });
  if (!resp.ok) throw new Error(`FCC list API ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return json.data ?? [];
}

async function downloadCsvStream(fileId: number): Promise<Readable> {
  const url = `${FCC_BASE}/api/public/map/downloads/downloadFile/availability/${fileId}/csv`;
  const resp = await fetch(url, { headers: fccHeaders });
  if (!resp.ok) throw new Error(`FCC download ${resp.status}`);

  // Response is a zip — decompress on the fly
  const contentType = resp.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await resp.arrayBuffer());

  if (contentType.includes("zip") || url.endsWith(".zip")) {
    // Node zlib can't unzip multi-file zips easily — write to temp and use unzip
    // Instead: detect and handle gzip, otherwise assume raw CSV
    try {
      const decompressed = zlib.gunzipSync(buffer);
      return Readable.from(decompressed);
    } catch {
      // Try inflate (zip's deflate)
      try {
        const decompressed = zlib.inflateRawSync(buffer.slice(30 + buffer[26] + buffer[28]));
        return Readable.from(decompressed);
      } catch {
        // Give up decompressing, return raw (might work if server decompresses)
        return Readable.from(buffer);
      }
    }
  }

  return Readable.from(buffer);
}

// ── CSV parsing ───────────────────────────────────────────────────────────────
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

async function extractBlockGeoids(stream: Readable): Promise<Map<string, string>> {
  // Returns map of block_geoid → state_abbr for AT&T tech-50 rows
  const result = new Map<string, string>();
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = line.split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
      continue;
    }

    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

    const brand = (row["brand_name"] ?? "").toLowerCase();
    const tech  = parseInt(row["technology"] ?? "0", 10);
    if ((!brand.includes("at&t") && !brand.includes("att")) || tech !== 50) continue;

    const geoid = row["block_geoid"] ?? row["block_fips"] ?? "";
    const state = row["state_usps"] ?? "";
    if (geoid && !result.has(geoid)) result.set(geoid, state);
  }

  return result;
}

// ── Census TIGERweb helpers ───────────────────────────────────────────────────
function ringToWkt(ring: number[][]): string {
  return `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(",")})`;
}

function geojsonToWkt(geom: { type: string; coordinates: unknown }): string {
  if (geom.type === "Polygon") {
    const coords = geom.coordinates as number[][][];
    return `POLYGON(${coords.map(ringToWkt).join(",")})`;
  }
  if (geom.type === "MultiPolygon") {
    const coords = geom.coordinates as number[][][][];
    return `MULTIPOLYGON(${coords.map(poly => `(${poly.map(ringToWkt).join(",")})`).join(",")})`;
  }
  throw new Error(`Unsupported: ${geom.type}`);
}

async function fetchCountyBlocks(stateFips: string, countyFips: string): Promise<Map<string, string>> {
  const params = new URLSearchParams({
    where:             `STATE='${stateFips}' AND COUNTY='${countyFips}'`,
    outSR:             "4326",
    f:                 "geojson",
    outFields:         "GEOID",
    returnGeometry:    "true",
    resultRecordCount: "10000",
  });

  const resp = await fetch(`${TIGER_BASE}?${params}`);
  if (!resp.ok) throw new Error(`Census API ${resp.status}`);

  const data = await resp.json();
  const result = new Map<string, string>();

  for (const feature of data.features ?? []) {
    const geoid: string = feature.properties?.GEOID;
    if (!geoid || !feature.geometry) continue;
    try {
      result.set(geoid, `SRID=4326;${geojsonToWkt(feature.geometry)}`);
    } catch { /* skip malformed */ }
  }
  return result;
}

// ── Supabase upsert ───────────────────────────────────────────────────────────
async function upsertBlocks(rows: { block_geoid: string; state_abbr: string; geom: string }[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("fcc_att_blocks")
      .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "block_geoid" });
    if (error) console.error(`  Upsert error: ${error.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nTarget states: ${TARGET_STATES.join(", ")}`);
  console.log(`As-of date: ${AS_OF_DATE}\n`);

  // Step 1: list available files
  console.log("Fetching FCC file list…");
  const allFiles = await listAvailabilityFiles(AS_OF_DATE);

  // Filter to target states (match by state_fips)
  const targetFips = new Set(TARGET_STATES.map(s => STATE_FIPS[s]).filter(Boolean));
  const stateFiles = allFiles.filter(f =>
    targetFips.has(f.state_fips.padStart(2, "0")) && f.file_type === "csv"
  );

  if (!stateFiles.length) {
    console.error("No matching CSV files found. Check AS_OF_DATE or state list.");
    console.log("Available states:", [...new Set(allFiles.map(f => f.state_name))].join(", "));
    process.exit(1);
  }

  console.log(`Found ${stateFiles.length} state file(s):\n`);
  stateFiles.forEach(f => console.log(`  ${f.state_name} — file_id ${f.file_id} (${Number(f.record_count).toLocaleString()} records)`));
  console.log();

  // Step 2: download + extract block GEOIDs for each state
  const allBlocks = new Map<string, string>(); // geoid → state_abbr

  for (const file of stateFiles) {
    console.log(`Downloading ${file.state_name}…`);
    try {
      const stream = await downloadCsvStream(file.file_id);
      const blocks = await extractBlockGeoids(stream);
      for (const [geoid, state] of blocks) allBlocks.set(geoid, state);
      console.log(`  ${blocks.size.toLocaleString()} AT&T fiber blocks`);
    } catch (e) {
      console.error(`  Failed: ${e}`);
    }
  }

  console.log(`\nTotal: ${allBlocks.size.toLocaleString()} unique blocks across all states\n`);

  // Step 3: group by county, fetch Census geometries, upsert
  const byCounty = new Map<string, Set<string>>();
  for (const geoid of allBlocks.keys()) {
    const key = `${geoid.slice(0, 2)}|${geoid.slice(2, 5)}`;
    if (!byCounty.has(key)) byCounty.set(key, new Set());
    byCounty.get(key)!.add(geoid);
  }

  console.log(`Fetching Census block boundaries for ${byCounty.size} counties…\n`);

  let inserted = 0;
  let countyNum = 0;
  const errors: string[] = [];

  for (const [countyKey, geoids] of byCounty) {
    countyNum++;
    const [stateFips, countyFips] = countyKey.split("|");
    process.stdout.write(`\r[${countyNum}/${byCounty.size}] ${stateFips}${countyFips} — ${geoids.size} blocks   `);

    try {
      const censusBlocks = await fetchCountyBlocks(stateFips, countyFips);

      const rows: { block_geoid: string; state_abbr: string; geom: string }[] = [];
      for (const geoid of geoids) {
        const wkt = censusBlocks.get(geoid);
        if (wkt) rows.push({ block_geoid: geoid, state_abbr: allBlocks.get(geoid) ?? "", geom: wkt });
      }

      await upsertBlocks(rows);
      inserted += rows.length;
    } catch (e) {
      errors.push(`${stateFips}${countyFips}: ${e}`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n\nInserted: ${inserted.toLocaleString()} blocks`);
  if (errors.length) {
    console.warn(`\nErrors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => console.warn(" ", e));
  }
  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
