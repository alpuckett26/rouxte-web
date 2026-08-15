/**
 * Adopt-gate proof harness for the Answers → Rouxte lead sync (rouxte-web#16).
 *
 * Runs the REAL upsertAnswersLead against an in-memory stand-in for the
 * Supabase admin client. No database, no credential, no network — geocoding
 * returns null without a Mapbox token, which is exactly the "lead lands
 * without coords" path, so nothing here is mocked that matters to the decision.
 *
 * WHY A FAKE DATABASE AND NOT A REIMPLEMENTATION OF THE RULES: a harness that
 * re-derives the verdict it is checking proves that two copies of an idea
 * agree. This one calls the shipping function and inspects the rows it left
 * behind, so it fails when the shipping function is wrong.
 *
 * THE PASS RUNS IN BOTH DIRECTIONS, WHICH IS THE ONLY REASON IT IS A PROOF.
 * Three cases must NOT adopt (wrong row, spine duplicate, ambiguous) and two
 * must still work (legitimate adopt, clean create). A gate that refuses
 * everything passes the first three and fails the last two; a rubber stamp
 * does the reverse. Neither can pass this file.
 *
 * Usage:  npx tsx scripts/answers-adopt-proof.ts
 * Exits non-zero if any case fails.
 */

import { createAdminClient } from "../lib/supabase/admin";
import { upsertAnswersLead } from "../lib/answers/upsertLead";
import type { AnswersPipelineRestaurant } from "../lib/answers/client";

const ORG = "org-0000";
const ACTOR = "actor-0000";

interface Row {
  id: string;
  org_id: string;
  status: string;
  address: string | null;
  customer_name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  assigned_to: string | null;
  external_source: string | null;
  external_ref: string | null;
  [key: string]: unknown;
}

/** ─── in-memory Supabase stand-in ──────────────────────────────────────── */

type Filter = (row: Row) => boolean;

function ilikeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

class FakeDb {
  rows: Row[] = [];
  inserts: Record<string, Record<string, unknown>[]> = {};
  private seq = 0;

  seed(row: Partial<Row> & { address: string }): Row {
    this.seq += 1;
    const full: Row = {
      id: `lead-${this.seq}`,
      org_id: ORG,
      status: "new",
      customer_name: null,
      phone: null,
      lat: null,
      lng: null,
      assigned_to: null,
      external_source: null,
      external_ref: null,
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  from(table: string) {
    const db = this;
    return {
      select() {
        const filters: Filter[] = [];
        let cap = Infinity;
        const api = {
          eq(col: string, val: unknown) {
            filters.push((r) => r[col] === val);
            return api;
          },
          is(col: string, val: unknown) {
            filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
            return api;
          },
          ilike(col: string, pattern: string) {
            const re = ilikeToRegExp(pattern);
            filters.push((r) => typeof r[col] === "string" && re.test(r[col] as string));
            return api;
          },
          limit(n: number) {
            cap = n;
            return api;
          },
          order() {
            return api;
          },
          rows(): Row[] {
            if (table !== "leads") return [];
            return db.rows.filter((r) => filters.every((f) => f(r))).slice(0, cap);
          },
          async maybeSingle() {
            const found = api.rows();
            return { data: found[0] ?? null, error: null };
          },
          async single() {
            const found = api.rows();
            return { data: found[0] ?? null, error: found[0] ? null : { message: "no rows" } };
          },
          // Awaiting the builder directly (no maybeSingle) returns the set.
          then(resolve: (v: { data: Row[]; error: null }) => unknown) {
            return Promise.resolve({ data: api.rows(), error: null }).then(resolve);
          },
        };
        return api;
      },

      insert(values: Record<string, unknown>) {
        (db.inserts[table] ||= []).push(values);
        let created: Row | null = null;
        if (table === "leads") {
          db.seq += 1;
          created = { id: `lead-${db.seq}`, ...(values as Partial<Row>) } as Row;
          db.rows.push(created);
        }
        const result = { data: created, error: null };
        return {
          select() {
            return {
              async single() {
                return result;
              },
            };
          },
          then(resolve: (v: typeof result) => unknown) {
            return Promise.resolve(result).then(resolve);
          },
        };
      },

      update(patch: Record<string, unknown>) {
        return {
          async eq(col: string, val: unknown) {
            for (const row of db.rows) {
              if (row[col] === val) Object.assign(row, patch);
            }
            return { error: null };
          },
        };
      },
    };
  }
}

const asAdmin = (db: FakeDb) => db as unknown as ReturnType<typeof createAdminClient>;

const incoming = (r: Partial<AnswersPipelineRestaurant> & { id: string }): AnswersPipelineRestaurant => ({
  name: "",
  slug: "",
  lifecycle_status: "lead",
  lifecycle_status_changed_at: null,
  created_at: "2026-08-15T00:00:00.000Z",
  assigned_to: null,
  address: null,
  phone_number: null,
  source_channel: null,
  ...r,
});

/** ─── cases ────────────────────────────────────────────────────────────── */

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail: string) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`        ${detail}`);
}

async function caseLegitimateAdopt() {
  console.log("\nS1  ADOPT — the pre-sync organic lead for this same business");
  const db = new FakeDb();
  const organic = db.seed({
    address: "1462 Airline Hwy, Baton Rouge, LA 70805",
    customer_name: "Dominique's Stockyard Cafe",
  });
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-dominiques",
    name: "Dominiques Stockyard Cafe",
    address: "1462 Airline Highway, Baton Rouge, LA 70805",
  }));
  check(
    "adopts the existing row instead of creating a second pin",
    result.action === "adopted" && result.leadId === organic.id && db.rows.length === 1,
    `action=${result.action} leadId=${result.leadId} rows=${db.rows.length} (want adopted/${organic.id}/1)`,
  );
  check(
    "the adopted row now carries the upstream ref",
    db.rows[0].external_ref === "R-dominiques",
    `external_ref=${db.rows[0].external_ref}`,
  );
}

async function caseWrongRowAdopt() {
  console.log("\nS2  MUST NOT ADOPT — different business, same building (the unrecoverable one)");
  const db = new FakeDb();
  const repLead = db.seed({
    address: "1462 Airline Hwy Ste A, Baton Rouge, LA 70805",
    customer_name: "Dominique's Stockyard Cafe",
    phone: "+12255550101",
    status: "interested",
    assigned_to: "rep-1",
  });
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-bayoubelle",
    name: "Bayou Belle's Po'boys & Plates",
    address: "1462 Airline Hwy, Baton Rouge, LA 70805",
    phone_number: "+12255559999",
  }));
  check(
    "does not adopt the neighbour's lead",
    result.action !== "adopted",
    `action=${result.action} (adopting here renames a worked lead to another business)`,
  );
  check(
    "the rep's lead keeps its own identity",
    db.rows[0].customer_name === "Dominique's Stockyard Cafe" &&
      db.rows[0].phone === "+12255550101" &&
      db.rows[0].external_ref === null,
    `name=${db.rows[0].customer_name} phone=${db.rows[0].phone} ref=${db.rows[0].external_ref}`,
  );
  check(
    "the new business gets its own pin",
    db.rows.length === 2 && result.action === "created",
    `rows=${db.rows.length} action=${result.action} (two businesses at one address = two pins)`,
  );
}

async function caseSpineDuplicate() {
  console.log("\nS3  MUST REFUSE — this place is already here under a different upstream ref");
  const db = new FakeDb();
  db.seed({
    address: "1461 Government St, Baton Rouge, LA 70802",
    customer_name: "Dee's Delightful Catering",
    external_source: "answers",
    external_ref: "R-dee-first",
    status: "pitched",
  });
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-dee-duplicate",
    name: "Dee's Delightful Catering",
    address: "1461 Government Street, Baton Rouge, LA 70802",
  }));
  check(
    "no second pin at the same address for the same business",
    db.rows.length === 1,
    `rows=${db.rows.length} action=${result.action}`,
  );
  check(
    "refuses out loud and names the row it found",
    result.action === "refused" && (result.reason ?? "").includes("R-dee-first"),
    `action=${result.action} reason=${result.reason ?? "(none)"}`,
  );
  check(
    "does NOT re-point the stored ref (that would merge two spine rows)",
    db.rows[0].external_ref === "R-dee-first",
    `external_ref=${db.rows[0].external_ref} (must stay R-dee-first)`,
  );
}

async function caseAmbiguous() {
  console.log("\nS4  MUST REFUSE — two candidates, no way to be certain which");
  const db = new FakeDb();
  db.seed({ address: "700 Main St, Baton Rouge, LA 70802", customer_name: "Cafe Express" });
  db.seed({ address: "700 Main Street, Baton Rouge, LA 70802", customer_name: "Cafe Express" });
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-cafeexpress",
    name: "Cafe Express",
    address: "700 Main St, Baton Rouge, LA 70802",
  }));
  check(
    "picks neither and creates neither",
    result.action === "refused" && db.rows.length === 2,
    `action=${result.action} rows=${db.rows.length} (limit(1) used to pick one silently)`,
  );
}

async function caseCleanCreate() {
  console.log("\nS5  CREATE — nothing we hold is this place (the rail must still work)");
  const db = new FakeDb();
  db.seed({ address: "9 Nowhere Rd, Baton Rouge, LA 70801", customer_name: "Unrelated Diner" });
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-brandnew",
    name: "Brand New Kitchen",
    address: "4321 Perkins Rd, Baton Rouge, LA 70808",
    phone_number: "+12255551234",
  }));
  check(
    "creates the lead",
    result.action === "created" && db.rows.length === 2,
    `action=${result.action} rows=${db.rows.length}`,
  );
  check(
    "carries the phone through (a phoneless lead is a rep who can't call ahead)",
    db.rows[1].phone === "+12255551234",
    `phone=${db.rows[1].phone}`,
  );
}

/**
 * S6 — the candidate scan hits its row cap.
 *
 * The gate's whole premise is that decideAdoption was handed EVERY row that
 * could be this place. A saturated scan breaks that premise while still
 * returning a confident-looking answer, which is the silent-zero shape. The
 * case is built so the truncated set CONTAINS a perfect adopt candidate: a
 * naive implementation adopts it and looks right. Refusing is the correct
 * answer precisely because the rows we could not see might hold a second one.
 */
async function caseScanSaturated() {
  console.log("\nS6  MUST REFUSE — the candidate scan was truncated (a partial set is not a set)");
  const db = new FakeDb();
  // One genuine, otherwise-adoptable row for this business...
  db.seed({
    address: "100 Main St, Baton Rouge, LA 70802",
    customer_name: "Capitol Diner",
    status: "new",
  });
  // ...buried in enough same-house-number rows to saturate the 200-row cap.
  for (let i = 0; i < 250; i += 1) {
    db.seed({ address: `100${i} Sherwood Forest Blvd, Baton Rouge, LA 70815`, customer_name: `Filler ${i}` });
  }
  const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, incoming({
    id: "R-capitol",
    name: "Capitol Diner",
    address: "100 Main St, Baton Rouge, LA 70802",
  }));
  check(
    "refuses instead of adopting against rows it could not see",
    result.action === "refused",
    `action=${result.action} (an exact name+address match was inside the truncated window)`,
  );
  check(
    "names the cap rather than reporting a generic ambiguity",
    (result.reason ?? "").includes("cap"),
    `reason=${result.reason}`,
  );
  check(
    "writes nothing",
    db.inserts.leads === undefined || db.inserts.leads.length === 0,
    `inserted=${db.inserts.leads?.length ?? 0}`,
  );
}

async function main() {
  console.log("ANSWERS ADOPT-GATE PROOF — real upsertAnswersLead, in-memory rows, no credential");
  await caseLegitimateAdopt();
  await caseWrongRowAdopt();
  await caseSpineDuplicate();
  await caseAmbiguous();
  await caseCleanCreate();
  await caseScanSaturated();
  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
