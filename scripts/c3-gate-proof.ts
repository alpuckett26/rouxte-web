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
 * MOVE-NOTHING TEST: section 7 performs the rename ITSELF, in memory, and
 * asserts nothing moved. It used to say "run this before an upstream rename and
 * after it" — and GroBigga handed that rename back on 2026-08-14 (GroBigga#52:
 * the scout host is Anseur's Render service, so renaming a file it serves is a
 * write to another product's production, and Gro has no write path to it
 * anyway). A proof whose trigger is another seat's scheduling reads as blocked
 * when it is merely untriggered, so the trigger is now ours. It is also the
 * stronger test: we can rename adversarially, which nobody was going to do
 * upstream on purpose.
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

// --- 7. The rename, performed here, adversarially ---------------------------

/** The membership artifact, as one comparable string. */
function fingerprint(): string {
  return createHash("sha256").update(c3Membership().join("\n")).digest("hex");
}

/**
 * A name-keyed gate — what C3 would be if someone had written the obvious
 * thing. Present ONLY as the counterfactual: it is what makes section 7 a test
 * rather than a tautology. Without it, "C3 did not move" is unfalsifiable,
 * because a gate that reads nothing also never moves. This one moves, in the
 * same pass, on the same rename, and admits the pan.
 *
 * It pins its allowed NAMES at audit time, which is the whole point and is not
 * a strawman — it is the same pinning discipline C3 applies to hashes, and it
 * is what any name-keyed gate must do to be deterministic. The difference is
 * only in what is pinned: a hash names the bytes, a filename names a slot that
 * upstream can refill. (Written the other way first — re-reading names from the
 * renamed manifest — it reported no flip and this harness failed it, which is
 * the section doing its job on its own author.)
 */
const PINNED_NAMES_AT_AUDIT = new Set(manifest.allowlist.map((e) => e.file));
const nameKeyedGate = (entry: ManifestEntry): boolean => PINNED_NAMES_AT_AUDIT.has(entry.file);

/**
 * Rename every file, and SWAP the name of an admitted plate with the name of
 * the excluded prep pan — the exact pair the room has been discussing
 * (`1aecabf0`, the pan, whose slug already reads as a plated dish). A rename
 * that merely appends a suffix is not much of a test; a rename that hands a
 * banned photo the name of a shipping one is the whole threat model.
 */
function renamedManifest(m: Manifest): { manifest: Manifest; swapped: [ManifestEntry, ManifestEntry] } {
  const copy: Manifest = JSON.parse(JSON.stringify(m));
  copy.allowlist.forEach((e, i) => (e.file = `renamed-a${i}.jpg`));
  copy.exclusions.forEach((e, i) => (e.file = `renamed-x${i}.jpg`));
  // The swap, applied last so it survives the blanket rename.
  const plate = copy.allowlist[2];
  const pan = copy.exclusions[0];
  plate.file = m.exclusions[0].file; // the shipping plate now wears the pan's name
  pan.file = m.allowlist[2].file; // and the pan wears the plate's
  return { manifest: copy, swapped: [pan, plate] };
}

function proveRename() {
  section("7. RENAME — performed here, not awaited from upstream");
  const before = fingerprint();
  const { manifest: renamed, swapped } = renamedManifest(manifest);
  const [pan, plate] = swapped;

  assert(
    renamed.allowlist.every((e, i) => e.file !== manifest.allowlist[i].file) &&
      renamed.exclusions.every((e, i) => e.file !== manifest.exclusions[i].file),
    `the rename actually renamed every row (${renamed.allowlist.length + renamed.exclusions.length} files)`,
  );
  assert(
    pan.md5.startsWith("1aecabf0") && pan.file === manifest.allowlist[2].file,
    `the excluded pan now wears an admitted plate's name`,
    `${pan.md5.slice(0, 8)} → "${pan.file}"`,
  );

  // The counterfactual moves...
  const panBefore = nameKeyedGate(manifest.exclusions[0]);
  const panAfter = nameKeyedGate(pan);
  assert(
    panBefore === false && panAfter === true,
    "a name-keyed gate FLIPS on this rename and admits the pan",
    `before=${panBefore} after=${panAfter} (this is the bug C3 exists to not have)`,
  );
  const plateAfter = nameKeyedGate(plate);
  assert(
    plateAfter === false,
    "and the same gate DROPS the shipping plate it was renamed off",
    `after=${plateAfter} (the rename costs a photo in both directions, not just one)`,
  );

  // ...and C3 does not.
  assert(!isAllowedPhotoHash(pan.md5), "C3 still rejects the pan under its new name", pan.md5);
  assert(isAllowedPhotoHash(plate.md5), "C3 still accepts the plate under its new name", plate.md5);
  for (const e of renamed.allowlist) assert(isAllowedPhotoHash(e.md5), `still accepts ${e.md5}`);
  for (const e of renamed.exclusions) assert(!isAllowedPhotoHash(e.md5), `still rejects ${e.md5}`);

  // And no new name became readable to the gate in the process.
  const renamedNames = [...renamed.allowlist, ...renamed.exclusions].map((e) => e.file);
  assert(
    renamedNames.every((n) => !gateSource.includes(n)),
    "no post-rename filename appears in the gate source either",
  );

  const after = fingerprint();
  assert(before === after, "membership fingerprint is byte-identical across the rename", after);
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
  proveRename();

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
