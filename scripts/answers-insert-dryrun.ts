/**
 * Insert-pass DRY RUN — what the live Answers → Rouxte load will actually do
 * (rouxte-web#16 item 3, rouxte-web#15).
 *
 * The pass itself is blocked on a DB hand (migration 038 is committed but
 * unapplied, and no seat here holds a credential). That is a reason the rows
 * are not in yet; it is NOT a reason for the outcome to be a surprise when the
 * hand lands. This runs the REAL `upsertAnswersLead` over the REAL captured
 * feed against an in-memory table, so the verdict for every row — created,
 * adopted, refused, skipped — is known and reviewable BEFORE anything touches
 * production. A dry run is the only part of a prod write that fits under a PR
 * gate, so it is the part that gets one.
 *
 * What is real here: the feed (verbatim capture), the upsert, the adopt gate,
 * the status mapping, the payload normalizer. What is not: the table (in
 * memory) and geocoding (returns null with no Mapbox token, which is simply the
 * "lands without coords" path — it changes lat/lng, never a verdict).
 *
 * It also reconciles the feed against GroBigga's independently-sourced 18-row
 * phone block. Two sources agreeing on a phone number is worth more than either
 * claiming it, and where they disagree the room should hear which one to trust.
 *
 * Usage:
 *   npx tsx scripts/answers-insert-dryrun.ts
 *   npx tsx scripts/answers-insert-dryrun.ts --feed=./some-other-capture.json
 *   npx tsx scripts/answers-insert-dryrun.ts --seed-existing   # replay onto a
 *       table that already holds the leads, i.e. the SECOND run of the pass
 *
 * Exits non-zero if an invariant fails — not if a row refuses. A refusal is a
 * finding to report, not a broken harness.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { upsertAnswersLead, normalizeAnswersLeadPayload } from "../lib/answers/upsertLead";
import { FakeDb, asAdmin, FAKE_ACTOR as ACTOR, FAKE_ORG as ORG } from "./lib/fakeLeadsDb";

const args = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const SEED_EXISTING = args.includes("--seed-existing");
const SEED_ORGANIC = args.includes("--seed-organic");
const FEED_PATH = resolve(
  process.cwd(),
  arg("feed") ?? "scripts/fixtures/answers-provision-leads-2026-08-15.json",
);
const PHONE_BLOCK_PATH = resolve(
  process.cwd(),
  arg("phone-block") ?? "scripts/fixtures/grobigga-phone-block-18.json",
);

interface PhoneBlockRow {
  n: number;
  external_ref: string;
  name: string;
  phone_number: string;
  city: string;
}

function readRows<T>(path: string, keys: string[]): T[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(raw)) return raw as T[];
  for (const k of keys) if (Array.isArray(raw[k])) return raw[k] as T[];
  throw new Error(`${path}: no row array found (looked for ${keys.join(", ")})`);
}

const feed = readRows<Record<string, unknown>>(FEED_PATH, ["leads", "rows", "data"]);
const phoneBlock = readRows<PhoneBlockRow>(PHONE_BLOCK_PATH, ["rows", "leads"]);

let failures = 0;
function invariant(ok: boolean, label: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Digits only, US country code dropped — for comparing two renderings. */
const digits = (v: string | null | undefined): string =>
  (v ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

/** The city as the spine's own address states it, not as anyone labelled it. */
function cityFromAddress(address: string | null | undefined): string | null {
  const m = (address ?? "").match(/,\s*([^,]+),\s*[A-Z]{2}\s+\d{5}/);
  return m ? m[1].trim() : null;
}

async function main() {
  console.log("ANSWERS INSERT-PASS DRY RUN — real upsertAnswersLead, in-memory table, no credential");
  console.log(`  feed         ${FEED_PATH} (${feed.length} rows)`);
  console.log(`  phone block  ${PHONE_BLOCK_PATH} (${phoneBlock.length} rows)`);
  const MODE = SEED_EXISTING
    ? "REPLAY onto an already-loaded table"
    : SEED_ORGANIC
      ? "ADOPT — a rep already holds every third door, organically"
      : "FIRST RUN onto an empty table";
  console.log(`  mode         ${MODE}`);

  const db = new FakeDb();
  const normalized = feed.map((r) => normalizeAnswersLeadPayload(r));

  // A payload the normalizer rejects never reaches the upsert, so it would be
  // invisible in the verdict table below. Count it here instead.
  const unparseable = feed.filter((_, i) => normalized[i] === null);

  if (SEED_EXISTING) {
    // The second run of the pass: every row already stored under its ref. This
    // is the idempotence question, and it is not academic — a rail that
    // re-inserts on replay gives every rep a duplicate pin.
    for (const r of normalized) {
      if (r?.address) {
        db.seed({
          address: r.address,
          customer_name: r.name || null,
          phone: r.phone_number,
          external_source: "answers",
          external_ref: r.id,
        });
      }
    }
  } else if (SEED_ORGANIC) {
    // The realistic middle: a rep already knocked some of these doors, so the
    // lead is here with no upstream ref and a street line typed by hand rather
    // than scraped. Every third row, worked and re-rendered (the ", USA" tail
    // dropped, "Hwy" spelled out) — these MUST adopt, not double-pin.
    for (let i = 0; i < normalized.length; i += 3) {
      const r = normalized[i];
      if (!r?.address) continue;
      db.seed({
        address: r.address.replace(/,\s*USA$/, "").replace(/\bHwy\b/, "Highway"),
        customer_name: r.name || null,
        status: "interested",
        assigned_to: "rep-1",
      });
    }
  }

  const rowsBefore = db.rows.length;
  const verdicts: {
    ref: string;
    name: string;
    action: string;
    reason?: string;
    phone: string | null;
    address: string | null;
  }[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const r = normalized[i];
    if (!r) continue;
    const result = await upsertAnswersLead(asAdmin(db), ORG, ACTOR, r);
    const stored = db.rows.find((row) => row.external_ref === r.id) ?? null;
    verdicts.push({
      ref: r.id,
      name: r.name || "(unnamed)",
      action: result.action,
      reason: result.reason,
      phone: stored?.phone ?? null,
      address: r.address,
    });
  }

  // ─── 1. the verdict table ────────────────────────────────────────────────
  console.log("\n1. PER-ROW VERDICT");
  const tally: Record<string, number> = {};
  for (const v of verdicts) {
    tally[v.action] = (tally[v.action] ?? 0) + 1;
    const flag = v.action === "created" || v.action === "updated" || v.action === "adopted" ? " " : "!";
    console.log(`  ${flag} ${v.action.padEnd(8)} ${v.name}`);
    if (v.reason) console.log(`      ↳ ${v.reason}`);
  }
  console.log(
    `\n  tally  ${Object.entries(tally).map(([k, n]) => `${k}=${n}`).join("  ")}   ` +
      `rows ${rowsBefore} → ${db.rows.length}`,
  );
  if (unparseable.length) {
    console.log(`  ${unparseable.length} feed row(s) carried no external ref and never reached the upsert`);
  }

  // ─── 2. the invariants ───────────────────────────────────────────────────
  console.log("\n2. INVARIANTS");
  invariant(
    unparseable.length === 0,
    "every feed row normalizes to a payload with an external ref",
    `${unparseable.length} unparseable`,
  );
  invariant(
    verdicts.length === feed.length,
    `all ${feed.length} feed rows were put through the upsert`,
    `${verdicts.length} processed`,
  );

  const written = verdicts.filter((v) => ["created", "updated", "adopted"].includes(v.action));
  const phoneless = written.filter((v) => !v.phone);
  invariant(
    phoneless.length === 0,
    "no lead lands phoneless (a rep who can't call ahead is the bug that hid here)",
    phoneless.map((v) => v.name).join(", "),
  );

  const refs = verdicts.map((v) => v.ref);
  invariant(new Set(refs).size === refs.length, "no external_ref appears twice in the feed");

  const storedRefs = db.rows.map((r) => r.external_ref).filter(Boolean);
  invariant(
    new Set(storedRefs).size === storedRefs.length,
    "no external_ref lands on two rows (the duplicate-pin failure)",
  );

  if (SEED_ORGANIC) {
    // The rep's row must be taken over, not shadowed by a second pin. The count
    // is the tell: 29 feed rows onto 10 organic rows must end at 29, not 39.
    invariant(
      db.rows.length === feed.length,
      "every organic lead was adopted, none double-pinned",
      `${rowsBefore} organic + ${feed.length} feed → ${db.rows.length} rows (want ${feed.length})`,
    );
    invariant(
      (tally.adopted ?? 0) === rowsBefore,
      `all ${rowsBefore} rep-held doors adopted`,
      `adopted=${tally.adopted ?? 0}`,
    );
    const keptStatus = db.rows.filter((r) => r.status === "interested").length;
    invariant(
      keptStatus === rowsBefore,
      "an adopted lead keeps the status the rep put it in (the spine wins only on 'new')",
      `${keptStatus}/${rowsBefore} still interested`,
    );
  }

  if (SEED_EXISTING) {
    invariant(
      db.rows.length === rowsBefore,
      "REPLAY IS IDEMPOTENT — a second pass creates nothing",
      `${rowsBefore} → ${db.rows.length}`,
    );
    invariant(
      tally.created === undefined && tally.adopted === undefined,
      "replay neither creates nor adopts; every row matches on its ref",
      Object.keys(tally).join(","),
    );
  }

  // The AI binding must not be inferred from a phone. We have no such column,
  // and this asserts that the sync did not invent one — the exact confusion
  // GroBigga flagged (phone_number = the restaurant's own line; ai_phone_number
  // = a Twilio binding that a prospect does not have).
  const aiColumnLeak = (db.inserts.leads ?? []).filter((row) =>
    Object.keys(row).some((k) => k.includes("ai_phone")),
  );
  invariant(
    aiColumnLeak.length === 0,
    "no row claims an AI phone binding it does not have",
    `${aiColumnLeak.length} rows carried an ai_phone* key`,
  );

  // ─── 3. cross-source reconciliation ──────────────────────────────────────
  console.log("\n3. CROSS-SOURCE — GroBigga's phone block vs the spine's own feed");
  const byRef = new Map(normalized.filter(Boolean).map((r) => [r!.id, r!]));
  let agree = 0;
  const missing: string[] = [];
  const phoneDisagree: string[] = [];
  const nameDisagree: string[] = [];
  const cityDisagree: string[] = [];

  for (const g of phoneBlock) {
    const spine = byRef.get(g.external_ref);
    if (!spine) {
      missing.push(`${g.n} ${g.name}`);
      continue;
    }
    if (digits(g.phone_number) === digits(spine.phone_number)) agree += 1;
    else phoneDisagree.push(`${g.n} ${g.name}: gro=${g.phone_number} spine=${spine.phone_number}`);
    if (g.name !== spine.name) nameDisagree.push(`${g.n} gro="${g.name}" spine="${spine.name}"`);
    const city = cityFromAddress(spine.address);
    if (city && city.toLowerCase() !== g.city.toLowerCase()) {
      cityDisagree.push(`${g.n} ${g.name}: labelled "${g.city}", address says "${city}"`);
    }
  }

  invariant(missing.length === 0, `all ${phoneBlock.length} phone-block rows exist in the feed`, missing.join("; "));
  invariant(
    phoneDisagree.length === 0,
    `phone agreement ${agree}/${phoneBlock.length} — two independent sources, same numbers`,
    phoneDisagree.join("; "),
  );
  invariant(nameDisagree.length === 0, "name agreement across both sources", nameDisagree.join("; "));
  if (cityDisagree.length) {
    // NOT an invariant failure: we take the address from the spine and never
    // read the block's city, so this cannot mis-place a pin on our map. It is
    // reported because it is wrong at the source, and anyone geo-targeting off
    // that column — a campaign radius, a "Baton Rouge" list — inherits it.
    console.log(`\n  NOTE  ${cityDisagree.length} city labels in the phone block disagree with the spine address:`);
    for (const d of cityDisagree) console.log(`        ${d}`);
    console.log("        Rouxte reads the address, not the label, so no pin moves. Reported for the source.");
  }

  // ─── 4. what the reps would receive ──────────────────────────────────────
  console.log("\n4. WHAT A REP WOULD SEE");
  const formats = new Map<string, number>();
  for (const v of written) {
    const style = /^\+1\d{10}$/.test(v.phone ?? "") ? "E.164 (+1225…)" : "formatted ((225) …)";
    formats.set(style, (formats.get(style) ?? 0) + 1);
  }
  for (const [style, n] of formats) console.log(`  ${n} leads with phone in ${style}`);
  if (formats.size > 1) {
    console.log(
      "  NOTE  the feed carries two phone renderings and the sync stores each verbatim.\n" +
        "        Both dial, so this is cosmetic today; it stops being cosmetic if anything\n" +
        "        ever dedupes or matches leads on the phone string. Not changed here —\n" +
        "        picking a canonical format is a decision about a rep-facing column, and\n" +
        "        it is not one of the three items on this wake.",
    );
  }
  const cities = new Map<string, number>();
  for (const v of written) {
    const c = cityFromAddress(v.address) ?? "(no city in address)";
    cities.set(c, (cities.get(c) ?? 0) + 1);
  }
  console.log(`  cities: ${[...cities].map(([c, n]) => `${c}=${n}`).join(", ")}`);

  console.log(
    `\n${failures === 0 ? "DRY RUN GREEN" : "DRY RUN RED"} — ` +
      `${Object.entries(tally).map(([k, n]) => `${n} ${k}`).join(", ")}; ${failures} invariant failure(s)`,
  );
  console.log(
    "\nThis wrote nothing. The live pass needs migration 038 applied and a DB\n" +
      "credential — both human gates, both still open (rouxte-web#15).",
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
