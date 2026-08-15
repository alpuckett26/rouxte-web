/**
 * C3 — the Dee photo gate (rouxte-web#16, item 1).
 *
 * ONE RULE: a photo is admissible IFF the md5 of its BYTES is in the pinned
 * allowlist. Not in the set = reject. This is an ALLOWLIST, never a denylist —
 * a denylist fails OPEN, because the seventh image nobody has vetted yet (a
 * re-scout, a restage, a menu re-pull) would sail through a "reject these two"
 * check and the gate would read green while admitting an unaudited photo.
 *
 * THE NAME IS NEVER A SELECTOR. Not the filename, not the slug, not a prefix,
 * not a substring, not the manifest's name column. This is the whole reason C3
 * exists: upstream, a file whose name reads like a plated dish is in fact a
 * kitchen prep pan and hashes to an exclusion, while a legitimately shipping
 * plate hashes to 00a0af02 under a name that says nothing. A name selector
 * would have admitted the banned photo and killed the shipping one. Filenames
 * are therefore absent from this file ENTIRELY — including from these
 * comments, because a comment gets read as a lookup key by the next hand, and
 * the proof harness asserts that absence. It follows that renaming a file — on
 * the scout host, in the manifest's name column, anywhere — cannot move a
 * single byte in or out of the six. That is a property of this file, not a
 * promise: there is not one filename in it to read.
 *
 * PINNED, NOT FETCHED. The allowlist is the six 32-hex strings below, with the
 * manifest commit recorded as provenance. A live read of the manifest at gate
 * time was considered and rejected: a fetch can fail, and the natural sloppy
 * handler for "zero hashes came back" is to accept. The drift a live read would
 * protect against is name-column drift, which by construction cannot reach a
 * gate that never reads names. The cost of pinning is that a seventh
 * LEGITIMATE photo rejects until this file is updated — a loud bug in the safe
 * direction, which is the trade being bought. A re-cut hash set is a BREAKING
 * change and rides the bus as one.
 *
 * FAIL CLOSED. If the pinned set is ever empty, short, or malformed, C3
 * rejects EVERYTHING. An empty allowlist that accepts is the denylist
 * fail-open wearing a new hat.
 *
 * Verify with `scripts/c3-gate-proof.ts`, which runs the accepts and the
 * discriminating negatives in a single pass. Six greens with no failing case
 * would also be returned by a selector that reads nothing and says yes.
 */

import { createHash } from "node:crypto";

/**
 * Where the six came from. Provenance only — nothing here is ever read as a
 * lookup key, and the manifest is not consulted at gate time.
 */
export const C3_PROVENANCE = {
  repo: "alpuckett26/GroBigga",
  path: "docs/dee-photo-manifest.json",
  commit: "04215d47eff53a70b62f71a7d97fc0805560664a",
  blob: "eb63575ed47a4103c8389679e1049c95986aaebc",
  merge: "9566d7fd738304c7b74888663130615b7bbf70d7",
  auditedAt: "2026-08-13",
  auditedBy: "grobigga",
  restaurantId: "9d4860ae-42aa-4256-8c38-30c5db7cac87",
} as const;

/**
 * The allowlist. Hash column ONLY — deliberately no captions, no filenames,
 * not even as a trailing comment, because a comment gets read as a lookup key
 * by the next hand.
 */
const PINNED_ALLOWLIST: readonly string[] = [
  "88a8c709e8def804c2ebb9b0c95919f0",
  "9d061d80be56f85f90a4c977c4a93abb",
  "b5c34fc759f057b78f44b56133b8a9e0",
  "635c0281045e3a065737ed1452ddf120",
  "00a0af02bb0fc3faa4b23c3a0e078670",
  "f895b577cc63859028ff9223b432af25",
];

/** The audited set is six. A set of any other size is a broken load. */
export const C3_EXPECTED_SIZE = 6;

/** Full 32-hex lowercase md5. Anchored both ends — a prefix is not 32 chars. */
const MD5_32_HEX = /^[0-9a-f]{32}$/;

/**
 * Normalize a candidate allowlist into a lookup set, or null if the load is in
 * any way not the audited six. Null is the fail-closed signal: every caller
 * treats it as "reject everything", never as "no constraints".
 */
function loadAllowlist(candidate: readonly string[]): ReadonlySet<string> | null {
  if (!Array.isArray(candidate)) return null;

  const normalized: string[] = [];
  for (const entry of candidate) {
    if (typeof entry !== "string") return null;
    const hash = entry.trim().toLowerCase();
    if (!MD5_32_HEX.test(hash)) return null;
    normalized.push(hash);
  }

  const set = new Set(normalized);
  // Size is checked AFTER dedupe: six entries with a duplicate is five
  // distinct photos, which is a broken manifest load, not a pass.
  if (set.size !== C3_EXPECTED_SIZE) return null;
  return set;
}

/** True when the pinned set loads as exactly the audited six. */
export function c3AllowlistIsHealthy(): boolean {
  return loadAllowlist(PINNED_ALLOWLIST) !== null;
}

/**
 * The pinned six, sorted — the canonical membership fingerprint. Run this
 * before and after an upstream rename; byte-identical output is the
 * "rename moves nothing" proof. Returns an empty array on an unhealthy load
 * so a broken gate can never present itself as a populated one.
 */
export function c3Membership(): readonly string[] {
  const set = loadAllowlist(PINNED_ALLOWLIST);
  return set ? [...set].sort() : [];
}

/**
 * THE GATE. Accepts iff `md5` is a full 32-hex string present in the
 * allowlist. Anything else — a short prefix, a filename, a slug, a caption,
 * a null, a hash that has simply never been audited — rejects.
 *
 * @param allowlist injectable ONLY so the proof harness can drive the
 *   fail-closed paths (empty set, short set, malformed set). Production
 *   callers pass nothing.
 */
export function isAllowedPhotoHash(
  md5: unknown,
  allowlist: readonly string[] = PINNED_ALLOWLIST,
): boolean {
  const set = loadAllowlist(allowlist);
  if (!set) return false; // fail closed — empty/short/malformed rejects everything

  if (typeof md5 !== "string") return false;
  const candidate = md5.trim().toLowerCase();
  if (!MD5_32_HEX.test(candidate)) return false;

  return set.has(candidate);
}

/** md5 of the exact bytes served. The only input C3 ever trusts. */
export function md5OfBytes(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

/**
 * Bytes in, verdict out — `md5(bytes) ∈ allowlist`. The filename those bytes
 * arrived under is not a parameter, by design.
 */
export function gatePhotoBytes(
  bytes: Uint8Array,
  allowlist: readonly string[] = PINNED_ALLOWLIST,
): { allowed: boolean; md5: string } {
  const md5 = md5OfBytes(bytes);
  return { allowed: isAllowedPhotoHash(md5, allowlist), md5 };
}
