/**
 * migrate-crm.ts — Bulk migrate leads from Spotio or LeadBeam into Rouxte
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/migrate-crm.ts \
 *     --platform spotio \
 *     --org-id <uuid> \
 *     --file export.csv
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/migrate-crm.ts \
 *     --platform leadbeam \
 *     --org-id <uuid> \
 *     --file leads.csv \
 *     --dry-run
 *
 * Flags:
 *   --platform   spotio | leadbeam | generic     (default: auto-detect)
 *   --org-id     Supabase org UUID               (required)
 *   --file       Path to CSV file                (required)
 *   --dry-run    Parse and preview, don't insert
 *   --truncate   Delete existing leads first (DANGER)
 *   --user-id    Import as this user UUID        (defaults to system user)
 *
 * The script:
 *  1. Parses the CSV and auto-detects the platform
 *  2. Maps columns to Rouxte fields
 *  3. Maps statuses to Rouxte statuses
 *  4. Geocodes rows missing lat/lng via Nominatim
 *  5. Inserts in batches of 500
 *  6. Writes notes for rows that have them
 */

import fs from "fs";
import path from "path";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE         = 500;
const GEOCODE_DELAY_MS   = 300;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Args ──────────────────────────────────────────────────────────────────────
function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
function hasFlag(flag: string) { return process.argv.includes(flag); }

const csvFile    = arg("--file");
const orgId      = arg("--org-id");
const platformArg = arg("--platform") as "spotio" | "leadbeam" | "generic" | undefined;
const dryRun     = hasFlag("--dry-run");
const truncate   = hasFlag("--truncate");
const importAsId = arg("--user-id");

if (!csvFile || !orgId) {
  console.error("Usage: migrate-crm.ts --org-id <uuid> --file export.csv [--platform spotio|leadbeam|generic] [--dry-run] [--truncate]");
  process.exit(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Platform = "spotio" | "leadbeam" | "generic";
type LeadStatus = "new" | "attempted" | "contacted" | "qualified" | "appointment_set" | "sold" | "installed" | "closed_lost";

interface MappedRow {
  address: string;
  customer_name: string | null;
  phone: string | null;
  status: LeadStatus;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  assigned_rep_name: string | null;
  follow_up_at: string | null;
  appointment_at: string | null;
  is_do_not_knock: boolean;
  original_created_at: string | null;
}

// ── Platform column maps ───────────────────────────────────────────────────────
const COLUMN_MAPS: Record<Platform, Record<string, string>> = {
  spotio: {
    address:       "address",
    city:          "city",
    state:         "state",
    zip:           "zip",
    first_name:    "first name",
    last_name:     "last name",
    phone:         "phone",
    status:        "status",
    assigned_to:   "assigned to",
    lat:           "latitude",
    lng:           "longitude",
    notes:         "notes",
    created_at:    "created date",
  },
  leadbeam: {
    address:       "address",
    full_name:     "name",
    phone:         "phone",
    status:        "status",
    assigned_to:   "rep",
    lat:           "lat",
    lng:           "long",
    notes:         "notes",
    created_at:    "created",
  },
  generic: {
    address:       "address",
    full_name:     "name",
    phone:         "phone",
    status:        "status",
    assigned_to:   "assigned to",
    lat:           "lat",
    lng:           "lng",
    notes:         "notes",
    created_at:    "created at",
  },
};

const STATUS_MAPS: Record<Platform, Record<string, LeadStatus>> = {
  spotio: {
    "not home":         "attempted",
    "no answer":        "attempted",
    "not interested":   "contacted",
    "do not knock":     "closed_lost",
    "pitched":          "contacted",
    "callback":         "contacted",
    "follow up":        "contacted",
    "appointment set":  "appointment_set",
    "sold":             "sold",
    "customer":         "sold",
    "installed":        "installed",
    "new":              "new",
    "":                 "new",
  },
  leadbeam: {
    "new":              "new",
    "contacted":        "contacted",
    "not home":         "attempted",
    "not interested":   "closed_lost",
    "appointment":      "appointment_set",
    "sold":             "sold",
    "":                 "new",
  },
  generic: {
    "new":              "new",
    "attempted":        "attempted",
    "contacted":        "contacted",
    "qualified":        "qualified",
    "appointment set":  "appointment_set",
    "sold":             "sold",
    "installed":        "installed",
    "closed":           "closed_lost",
    "lost":             "closed_lost",
    "":                 "new",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectPlatform(headers: string[]): Platform {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("assigned to") || h.includes("first name")) return "spotio";
  if (h.includes("rep") && !h.includes("assigned to")) return "leadbeam";
  return "generic";
}

function findCol(headers: string[], ...candidates: string[]): number {
  const h = headers.map((x) => x.toLowerCase().trim());
  for (const c of candidates) {
    const idx = h.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Rouxte/1.0 (migration)" } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function mapStatus(raw: string, platform: Platform): LeadStatus {
  const key = (raw ?? "").toLowerCase().trim();
  return STATUS_MAPS[platform][key] ?? "new";
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const absPath = path.resolve(csvFile!);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`\nRouxte CRM Migration Tool`);
  console.log(`File:     ${path.basename(absPath)}`);
  console.log(`Org ID:   ${orgId}`);
  console.log(`Dry run:  ${dryRun ? "YES — no data will be written" : "NO"}`);

  // Read CSV
  const rl = createInterface({ input: fs.createReadStream(absPath), crlfDelay: Infinity });
  let headers: string[] = [];
  const rawRows: string[][] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = parseCsvLine(line).map((h) => h.replace(/^"|"$/g, ""));
      continue;
    }
    if (line.trim()) rawRows.push(parseCsvLine(line));
  }

  const platform: Platform = platformArg ?? detectPlatform(headers);
  console.log(`Platform: ${platform} (${rawRows.length.toLocaleString()} rows)\n`);

  // Resolve column indices
  const cm = COLUMN_MAPS[platform];
  const colIdx = {
    address:    findCol(headers, cm.address ?? "", "address", "street address", "street"),
    city:       findCol(headers, cm.city ?? "", "city"),
    state:      findCol(headers, cm.state ?? "", "state"),
    zip:        findCol(headers, cm.zip ?? "", "zip", "postal code"),
    first_name: findCol(headers, cm.first_name ?? "", "first name", "firstname"),
    last_name:  findCol(headers, cm.last_name ?? "", "last name", "lastname"),
    full_name:  findCol(headers, cm.full_name ?? "", "name", "full name"),
    phone:      findCol(headers, cm.phone ?? "", "phone", "mobile", "cell"),
    status:     findCol(headers, cm.status ?? "", "status", "stage"),
    assigned:   findCol(headers, cm.assigned_to ?? "", "assigned to", "rep", "agent"),
    lat:        findCol(headers, cm.lat ?? "", "latitude", "lat"),
    lng:        findCol(headers, cm.lng ?? "", "longitude", "long", "lng"),
    notes:      findCol(headers, cm.notes ?? "", "notes", "note"),
    follow_up:  findCol(headers, "follow up date", "follow-up date", "followup"),
    appt:       findCol(headers, "appointment date", "appointment", "appt"),
    created_at: findCol(headers, cm.created_at ?? "", "created date", "created at", "created", "date added"),
  };

  console.log("Column mapping:");
  Object.entries(colIdx).forEach(([field, idx]) => {
    if (idx >= 0) console.log(`  ${field.padEnd(12)} → "${headers[idx]}"`);
  });
  console.log();

  // Map rows
  const g = (row: string[], idx: number) => idx >= 0 ? (row[idx] ?? "").trim() : "";
  const mapped: MappedRow[] = [];
  let skipped = 0;

  for (const row of rawRows) {
    const addrParts = [g(row, colIdx.address), g(row, colIdx.city), g(row, colIdx.state), g(row, colIdx.zip)].filter(Boolean);
    const address = addrParts.join(", ");
    if (!address) { skipped++; continue; }

    const nameParts = colIdx.full_name >= 0
      ? [g(row, colIdx.full_name)]
      : [g(row, colIdx.first_name), g(row, colIdx.last_name)];
    const customer_name = nameParts.filter(Boolean).join(" ") || null;

    const rawLat = parseFloat(g(row, colIdx.lat));
    const rawLng = parseFloat(g(row, colIdx.lng));
    const rawStatus = g(row, colIdx.status);

    mapped.push({
      address,
      customer_name,
      phone:              g(row, colIdx.phone) || null,
      status:             mapStatus(rawStatus, platform),
      lat:                isNaN(rawLat) ? null : rawLat,
      lng:                isNaN(rawLng) ? null : rawLng,
      notes:              g(row, colIdx.notes) || null,
      assigned_rep_name:  g(row, colIdx.assigned) || null,
      follow_up_at:       g(row, colIdx.follow_up) || null,
      appointment_at:     g(row, colIdx.appt) || null,
      is_do_not_knock:    rawStatus.toLowerCase().includes("do not knock"),
      original_created_at: g(row, colIdx.created_at) || null,
    });
  }

  console.log(`Mapped:  ${mapped.length.toLocaleString()} rows`);
  console.log(`Skipped: ${skipped.toLocaleString()} (no address)`);

  // Status summary
  const statusCounts: Record<string, number> = {};
  mapped.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1; });
  console.log("\nStatus breakdown:");
  Object.entries(statusCounts).forEach(([s, n]) => console.log(`  ${s.padEnd(18)} ${n.toLocaleString()}`));

  // Rep summary
  const repNames = Array.from(new Set(mapped.map((r) => r.assigned_rep_name).filter(Boolean)));
  if (repNames.length) {
    console.log(`\nRep names (${repNames.length}):`);
    repNames.forEach((n) => console.log(`  ${n}`));
    console.log("  → Run with '--user-id' to assign to a specific rep, or match manually in the app.");
  }

  if (dryRun) {
    console.log("\nDry run — stopping before insert. Re-run without --dry-run to import.");
    return;
  }

  // Truncate if requested
  if (truncate) {
    console.log("\nTruncating existing leads for org…");
    const { error } = await supabase.from("leads").delete().eq("org_id", orgId);
    if (error) { console.error("Truncate failed:", error.message); process.exit(1); }
    console.log("Done.\n");
  }

  // Get creator user_id (importAsId or first admin in org)
  let creatorId = importAsId;
  if (!creatorId) {
    const { data: admin } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    creatorId = admin?.user_id;
  }
  if (!creatorId) {
    console.error("No admin found for org. Pass --user-id explicitly.");
    process.exit(1);
  }

  // Geocode missing coordinates
  const needsGeocode = mapped.filter((r) => !r.lat || !r.lng);
  if (needsGeocode.length) {
    console.log(`\nGeocoding ${needsGeocode.length} rows without coordinates…`);
    let done = 0;
    for (const row of needsGeocode) {
      const coords = await geocode(row.address);
      if (coords) { row.lat = coords.lat; row.lng = coords.lng; }
      done++;
      if (done % 10 === 0) process.stdout.write(`\r  ${done}/${needsGeocode.length}`);
      await sleep(GEOCODE_DELAY_MS);
    }
    console.log(`\r  Done geocoding.      `);
  }

  // Filter out rows still missing coordinates
  const insertable = mapped.filter((r) => r.lat && r.lng);
  const geoFailed  = mapped.length - insertable.length;
  if (geoFailed) console.log(`  ${geoFailed} rows dropped — could not geocode address.`);

  // Batch insert
  console.log(`\nInserting ${insertable.length.toLocaleString()} leads…`);
  let totalInserted = 0;
  let totalFailed = 0;
  const insertedIds: { id: string }[] = [];

  for (let i = 0; i < insertable.length; i += BATCH_SIZE) {
    const chunk = insertable.slice(i, i + BATCH_SIZE).map((r) => ({
      org_id:              orgId,
      created_by:          creatorId,
      address:             r.address,
      customer_name:       r.customer_name,
      phone:               r.phone,
      lat:                 r.lat!,
      lng:                 r.lng!,
      carrier_availability: {},
      status:              r.status,
      assigned_to:         null,  // rep matching requires user_id lookup — do in app
      follow_up_at:        r.follow_up_at || null,
      appointment_at:      r.appointment_at || null,
      is_do_not_knock:     r.is_do_not_knock,
      source:              "import",
      created_at:          r.original_created_at || new Date().toISOString(),
    }));

    const { data, error } = await supabase.from("leads").insert(chunk).select("id");
    if (error) { console.error(`\nBatch error: ${error.message}`); totalFailed += chunk.length; continue; }
    totalInserted += data?.length ?? 0;
    insertedIds.push(...(data ?? []));
    process.stdout.write(`\r  ${totalInserted.toLocaleString()} inserted…`);
  }

  // Insert notes
  const withNotes = insertable.filter((r, i) => r.notes && insertedIds[i]);
  if (withNotes.length) {
    console.log(`\n\nInserting ${withNotes.length} notes…`);
    const noteInserts = withNotes.map((r, i) => ({
      lead_id:   insertedIds[insertable.indexOf(r)].id,
      author_id: creatorId!,
      body:      `[Imported from ${platform}] ${r.notes}`,
    }));
    const { error } = await supabase.from("lead_notes").insert(noteInserts);
    if (error) console.error("Notes insert error:", error.message);
  }

  console.log(`\n\n✓ Migration complete`);
  console.log(`  Inserted: ${totalInserted.toLocaleString()}`);
  console.log(`  Failed:   ${totalFailed.toLocaleString()}`);
  console.log(`  Geocoded: ${needsGeocode.length.toLocaleString()}`);
  console.log(`\nNext: open the app → Manager → Migrate to assign reps by name.\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
