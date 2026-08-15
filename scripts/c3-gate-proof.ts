/**
 * C3 gate proof harness (rouxte-web#16, item 1).
 *
 * Runs the accepts AND the discriminating negatives in ONE pass. Six greens on
 * their own prove nothing — a selector that reads nothing and says yes returns
 * the same six greens. The negatives are what make it a gate.
 *
 * Usage:
 *   npx tsx scripts/c3-gate-proof.ts
 *   npx tsx scripts/c3-gate-proof.ts --manifest=../grobigga/docs/dee-photo-manifest.json
 *   npx tsx scripts/c3-gate-proof.ts --fetch     # also md5 the real served bytes
 *
 * The manifest is GroBigga's file, read-only, and is an INPUT TO THE PROOF —
 * never to the gate. Filenames exist only inside this harness, sourced from
 * that manifest, so that "a name is never a selector" can be asserted against
 * real names without a single one entering rouxte-web's gate source.
 *
 * MOVE-NOTHING TEST: run this before an upstream rename and after it. The
 * MEMBERSHIP block must be byte-identical. Necessary but not sufficient —
 * which is why the negatives run in the same pass.
 *
 * Exits non-zero if any assertion fails.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  C3_EXPECTED_SIZE,
  C3_PROVENANCE,
  c3AllowlistIsHealthy,
  c3Membership,
  gatePhotoBytes,
  isAllowedPhotoHash,
} from "../lib/photos/c3";

interface ManifestEntry {
  md5: string;
  file: string;
}
interface Manifest {
  allowlist: ManifestEntry[];
  exclusions: ManifestEntry[];
  duplicate_names_retired?: Record<string, unknown>;
  asset_base?: string;
}

const args = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const FETCH_BYTES = args.includes("--fetch");
const MANIFEST_PATH = resolve(
  process.cwd(),
  arg("manifest") ?? process.env.C3_MANIFEST_PATH ?? "../grobigga/docs/dee-photo-manifest.json",
);
const GATE_SOURCE_PATH = resolve(process.cwd(), "lib/photos/c3.ts");

let failures = 0;
let checks = 0;

function assert(ok: boolean, label: string, detail = "") {
  checks++;
  if (!ok) failures++;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
} catch (err) {
  console.error(`Cannot read the manifest at ${MANIFEST_PATH}`);
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  console.error(
    "\nThe proof needs GroBigga's manifest as an independent input — running the" +
      "\nallowlist against itself would be circular. Pass --manifest=<path> or set" +
      "\nC3_MANIFEST_PATH. This is a read-only read of another repo's committed file.",
  );
  process.exit(2);
}

const manifestAllowed = manifest.allowlist.map((e) => e.md5.toLowerCase());
const manifestExcluded = manifest.exclusions.map((e) => e.md5.toLowerCase());
const manifestNames = [
  ...manifest.allowlist.map((e) => e.file),
  ...manifest.exclusions.map((e) => e.file),
  ...Object.values(manifest.duplicate_names_retired ?? {})
    .filter((v): v is string[] => Array.isArray(v))
    .flat(),
];

console.log("C3 GATE PROOF");
console.log(`  gate      lib/photos/c3.ts`);
console.log(`  manifest  ${MANIFEST_PATH}`);
console.log(`  pinned to ${C3_PROVENANCE.repo}@${C3_PROVENANCE.commit.slice(0, 7)} (blob ${C3_PROVENANCE.blob.slice(0, 8)})`);

// --- 0. The set loads as the audited six ------------------------------------
section("0. LOAD");
assert(c3AllowlistIsHealthy(), "pinned allowlist loads healthy");
assert(
  c3Membership().length === C3_EXPECTED_SIZE,
  `membership is exactly ${C3_EXPECTED_SIZE}`,
  `got ${c3Membership().length}`,
);

// --- 1. The six accept ------------------------------------------------------
section("1. ACCEPT — the audited six");
for (const md5 of manifestAllowed) {
  assert(isAllowedPhotoHash(md5), `accepts ${md5}`);
}

// --- 2. Drift: the pin still equals the manifest -----------------------------
section("2. DRIFT — pinned set vs manifest allowlist");
const pinned = new Set(c3Membership());
const upstream = new Set(manifestAllowed);
const missingFromPin = [...upstream].filter((h) => !pinned.has(h));
const extraInPin = [...pinned].filter((h) => !upstream.has(h));
assert(missingFromPin.length === 0, "no manifest hash missing from the pin", missingFromPin.join(", "));
assert(extraInPin.length === 0, "no pinned hash absent from the manifest", extraInPin.join(", "));

// --- 3. The discriminating negatives ----------------------------------------
section("3. REJECT — the exclusions, by hash");
for (const md5 of manifestExcluded) {
  assert(!isAllowedPhotoHash(md5), `rejects ${md5}`);
}

section("3b. REJECT — a never-audited hash (allowlist, not denylist)");
// The failure a denylist cannot catch: a seventh image nobody has vetted.
// Deterministic and provably not one of the six.
const unvetted = createHash("md5").update("c3-unvetted-seventh-photo").digest("hex");
assert(!pinned.has(unvetted), "test hash is genuinely outside the six", unvetted);
assert(!isAllowedPhotoHash(unvetted), `rejects unvetted ${unvetted}`);

// --- 4. The name is never a selector ----------------------------------------
section("4. NAME IS NEVER A SELECTOR");
const gateSource = readFileSync(GATE_SOURCE_PATH, "utf8");
const leakedNames = manifestNames.filter((n) => gateSource.includes(n));
assert(
  leakedNames.length === 0,
  `no manifest filename appears in the gate source (${manifestNames.length} names checked)`,
  leakedNames.join(", "),
);
for (const name of manifestNames.slice(0, 3)) {
  assert(!isAllowedPhotoHash(name), `rejects the filename "${name}" as a candidate`);
}
// A rename upstream changes only `file`. Nothing above reads it, so membership
// cannot move — the MEMBERSHIP block below is the byte-identical artifact.

section("4b. REJECT — prefixes and substrings, not just wrong hashes");
const member = c3Membership()[0];
assert(!isAllowedPhotoHash(member.slice(0, 31)), "rejects a 31-char prefix of a member");
assert(!isAllowedPhotoHash(member.slice(0, 8)), "rejects an 8-char prefix of a member");
assert(!isAllowedPhotoHash(`x${member}`), "rejects a member embedded in a longer string");
assert(!isAllowedPhotoHash(`${member} `.repeat(2)), "rejects a member repeated");
assert(isAllowedPhotoHash(member.toUpperCase()), "accepts a member in uppercase (case is not the selector)");

// --- 5. Fail closed ---------------------------------------------------------
section("5. FAIL CLOSED — a broken set rejects everything");
const short = c3Membership().slice(0, C3_EXPECTED_SIZE - 1);
// A name in the hash column — the exact shape of a manifest read gone wrong.
const malformed = [...c3Membership().slice(0, C3_EXPECTED_SIZE - 1), manifest.exclusions[0].file];
const dupe = [...c3Membership().slice(0, C3_EXPECTED_SIZE - 1), c3Membership()[0]];
for (const [label, set] of [
  ["empty set", [] as string[]],
  ["short set", short],
  ["malformed set", malformed],
  ["set with a duplicate", dupe],
] as const) {
  const anyAccepted = c3Membership().some((h) => isAllowedPhotoHash(h, set));
  assert(!anyAccepted, `${label} rejects all six`);
}

// --- 6. Bytes (optional) ----------------------------------------------------
async function proveBytes() {
  if (!FETCH_BYTES) {
    section("6. BYTES — skipped (pass --fetch to md5 the live served bytes)");
    return;
  }
  section("6. BYTES — md5 of what the asset host actually serves");
  const base = manifest.asset_base?.replace(/\/$/, "");
  if (!base) {
    assert(false, "manifest carries an asset_base to fetch from");
    return;
  }
  for (const entry of [...manifest.allowlist, ...manifest.exclusions]) {
    const shouldPass = manifestAllowed.includes(entry.md5.toLowerCase());
    const url = `${base}/${entry.file}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        assert(false, `fetch ${entry.file}`, `HTTP ${res.status}`);
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { allowed, md5 } = gatePhotoBytes(bytes);
      assert(md5 === entry.md5.toLowerCase(), `served bytes md5 matches manifest for ${entry.file}`, md5);
      assert(allowed === shouldPass, `gate verdict ${shouldPass ? "ACCEPT" : "REJECT"} for ${entry.file}`);
    } catch (err) {
      assert(false, `fetch ${url}`, err instanceof Error ? err.message : String(err));
    }
  }
}

proveBytes().then(() => {
  // --- MEMBERSHIP: the move-nothing artifact --------------------------------
  const membership = c3Membership();
  const fingerprint = createHash("sha256").update(membership.join("\n")).digest("hex");
  console.log("\n--- MEMBERSHIP (must be byte-identical across an upstream rename) ---");
  for (const h of membership) console.log(h);
  console.log(`sha256=${fingerprint}`);
  console.log("--- END MEMBERSHIP ---");

  console.log(`\n${failures === 0 ? "C3 PROOF GREEN" : "C3 PROOF RED"} — ${checks - failures}/${checks} assertions passed`);
  process.exit(failures === 0 ? 0 : 1);
});
