/**
 * Import AT&T fiber census block coverage into Supabase fcc_att_blocks table.
 *
 * Steps:
 *   1. Read FCC BDC CSV(s) — extract unique block_geoid where AT&T tech = 50 (FTTP)
 *   2. Group by state + county (first 5 digits of block_geoid)
 *   3. For each county, fetch block boundary polygons from Census TIGERweb API
 *   4. Upsert covered blocks with geometries into fcc_att_blocks
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/import-fcc-blocks.ts <csv> [csv2...]
 *
 * Run migration 018 in Supabase SQL editor before running this script.
 */

import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 100;
// Census TIGERweb — layer 12 = Census 2020 Blocks
const TIGER_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/12/query";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const csvFiles = process.argv.slice(2);
if (!csvFiles.length) {
  console.error("Usage: npx tsx scripts/import-fcc-blocks.ts <csv> [csv2...]");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── GeoJSON → WKT (Postgres/PostGIS accepts SRID=4326;<WKT>) ─────────────────
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
  throw new Error(`Unsupported geometry type: ${geom.type}`);
}

// ── Fetch all block geometries for one county from Census TIGERweb ────────────
async function fetchCountyBlocks(
  stateFips: string,
  countyFips: string
): Promise<Map<string, string>> {
  const params = new URLSearchParams({
    where:          `STATE='${stateFips}' AND COUNTY='${countyFips}'`,
    outSR:          "4326",
    f:              "geojson",
    outFields:      "GEOID",
    returnGeometry: "true",
    resultRecordCount: "10000",
  });

  const resp = await fetch(`${TIGER_URL}?${params}`);
  if (!resp.ok) throw new Error(`Census API ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const result = new Map<string, string>();

  for (const feature of data.features ?? []) {
    const geoid: string = feature.properties?.GEOID;
    if (!geoid || !feature.geometry) continue;
    try {
      result.set(geoid, `SRID=4326;${geojsonToWkt(feature.geometry)}`);
    } catch {
      // skip malformed geometries
    }
  }
  return result;
}

// ── Parse a CSV line handling quoted fields ───────────────────────────────────
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

// ── Read FCC BDC CSV → map of block_geoid → state_abbr ───────────────────────
async function readBlockGeoids(csvPath: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const rl = createInterface({ input: fs.createReadStream(csvPath), crlfDelay: Infinity });

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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Step 1: collect all covered block GEOIDs from CSV files
  const allBlocks = new Map<string, string>(); // geoid → state_abbr
  for (const f of csvFiles) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) { console.error(`Not found: ${abs}`); continue; }
    console.log(`Reading ${path.basename(f)}…`);
    for (const [geoid, state] of await readBlockGeoids(abs)) {
      allBlocks.set(geoid, state);
    }
  }
  console.log(`\n${allBlocks.size.toLocaleString()} unique AT&T fiber blocks identified.\n`);

  // Step 2: group by state+county (first 5 chars of GEOID)
  const byCounty = new Map<string, Set<string>>(); // "SS|CCC" → Set<geoid>
  for (const geoid of allBlocks.keys()) {
    const key = `${geoid.slice(0, 2)}|${geoid.slice(2, 5)}`;
    if (!byCounty.has(key)) byCounty.set(key, new Set());
    byCounty.get(key)!.add(geoid);
  }
  console.log(`Spanning ${byCounty.size} counties. Fetching Census block boundaries…\n`);

  let inserted = 0;
  let countyNum = 0;
  const errors: string[] = [];

  for (const [countyKey, geoids] of byCounty) {
    countyNum++;
    const [stateFips, countyFips] = countyKey.split("|");
    process.stdout.write(
      `\r[${countyNum}/${byCounty.size}] ${stateFips}${countyFips} — ${geoids.size} blocks   `
    );

    try {
      const censusBlocks = await fetchCountyBlocks(stateFips, countyFips);

      const rows: { block_geoid: string; state_abbr: string; geom: string }[] = [];
      for (const geoid of geoids) {
        const wkt = censusBlocks.get(geoid);
        if (wkt) rows.push({ block_geoid: geoid, state_abbr: allBlocks.get(geoid) ?? "", geom: wkt });
      }

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const { error } = await supabase
          .from("fcc_att_blocks")
          .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "block_geoid" });
        if (error) errors.push(`${stateFips}${countyFips}: ${error.message}`);
        else inserted += Math.min(BATCH_SIZE, rows.length - i);
      }
    } catch (e) {
      errors.push(`${stateFips}${countyFips}: ${e}`);
    }

    // Polite delay — Census TIGERweb has no published rate limit but be a good citizen
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n\nInserted: ${inserted.toLocaleString()} blocks`);
  if (errors.length) {
    console.warn(`\nErrors (${errors.length}):`);
    errors.forEach(e => console.warn(" ", e));
  }
  console.log("\nDone. Run migration 018 in Supabase if not already applied.");
}

main().catch(err => { console.error(err); process.exit(1); });
