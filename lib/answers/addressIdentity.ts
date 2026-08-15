/**
 * Address/name identity for the Answers → Rouxte lead sync (rouxte-web#16).
 *
 * WHY THIS FILE EXISTS. The spine shipped a duplicate-row gate on
 * POST /internal/provision/restaurants because "two callers describing the same
 * establishment have always produced two restaurants." Rouxte is READ-SIDE on
 * that lane — we never call create — so none of that gate's verdicts are a
 * caller change for us. What reaches us is the consequence: if two spine rows
 * ever describe one place, our sync turns them into two pins at one address for
 * a rep, and once a lead leaves 'new' the rep is authoritative and no cron can
 * reconcile it afterwards.
 *
 * But the worse defect was on our side and predates any duplicate. The adopt
 * path used a street-line PREFIX match with limit(1), no ordering, and NO NAME
 * COMPARISON AT ALL. A rep-created lead for "1462 Airline Hwy Ste A" would be
 * prefix-matched by a spine restaurant scraped as "1462 Airline Hwy" — a
 * different business in the same building — and adopted. Adoption then writes
 * customer_name, phone and address onto that row unconditionally, because
 * identity always refreshes from the system of record. The rep's worked lead
 * silently becomes a different restaurant.
 *
 * THE RANKING THAT DECIDES EVERY TRADE HERE, borrowed from the spine and not
 * re-argued: adopting the WRONG row is unrecoverable in a way a duplicate is
 * not, because it merges two businesses and there is no later signal that says
 * it happened. A duplicate is visible, countable, and fixable. So every
 * threshold in this file is tuned so that its failure mode is a second pin,
 * never a merge.
 *
 * SAME ADDRESS, DIFFERENT NAME IS NOT A MATCH. It is also not an error: a strip
 * mall genuinely holds two businesses, and both deserve a pin. The spine
 * refuses that case because a second RESTAURANT row is the harm there; on our
 * side a second LEAD row is the correct outcome. Same rule, opposite action,
 * and the difference is deliberate — see decideAdoption's "create" verdict,
 * which still names the neighbour rather than pretending it found nothing.
 *
 * DELIBERATELY EXACT, NEVER FUZZY. No edit distance, no token overlap
 * scoring, no "close enough." Names compare equal or they do not. The cost is
 * that two spine rows for one place under slightly different names ("Dee's
 * Delightful Catering" vs "Dee's Delightful Catering LLC") will NOT be caught
 * as a duplicate and will land as two pins. That is a real, stated hole, and it
 * is the recoverable direction — do not "fix" it with fuzzy matching, because
 * the same looseness that closes it opens the merge.
 */

/** Fields the sync needs in order to decide whether a stored lead is this place. */
export interface CandidateLead {
  id: string;
  status: string;
  lat: number | null;
  lng: number | null;
  assigned_to: string | null;
  address: string | null;
  customer_name: string | null;
  external_ref: string | null;
  external_source: string | null;
}

export type AdoptDecision =
  /** Exactly one stored lead is this place and carries no upstream ref yet. */
  | { verdict: "adopt"; lead: CandidateLead }
  /**
   * Nothing we hold is this place. Neighbours (same address, different name)
   * are carried so the caller can log WHAT it created alongside — a create that
   * cannot say what else is at the address reads like a clean insert.
   */
  | { verdict: "create"; alongside: CandidateLead[] }
  /**
   * Certainty failed. No insert, no re-point, no arbitrary pick — the caller
   * surfaces this and a human or the spine decides.
   *   duplicate_external_ref — this place is already here under a DIFFERENT
   *     upstream ref. Creating gives the rep two pins; re-pointing the stored
   *     ref from A to B merges two spine rows into one lead, which is the
   *     unrecoverable direction. So: neither, loudly.
   *   ambiguous_address — more than one stored lead could be this place. The
   *     old code took limit(1) and picked one silently; that is the bug.
   */
  | {
      verdict: "refuse";
      reason: "duplicate_external_ref" | "ambiguous_address";
      neighbours: CandidateLead[];
    };

/** Street-type abbreviations canonicalized so "Hwy" and "Highway" key alike. */
const STREET_SUFFIXES: Record<string, string> = {
  hwy: "highway",
  st: "street",
  str: "street",
  rd: "road",
  ave: "avenue",
  av: "avenue",
  blvd: "boulevard",
  dr: "drive",
  ln: "lane",
  pkwy: "parkway",
  pky: "parkway",
  pl: "place",
  ct: "court",
  cir: "circle",
  ter: "terrace",
  trl: "trail",
  expy: "expressway",
};

/** Unit designators dropped from the address key — a suite is not a place. */
const UNIT_WORDS = new Set(["ste", "suite", "apt", "apartment", "unit", "bldg", "building", "rm", "room", "fl", "floor", "no"]);

/**
 * lowercase · & → and · apostrophes and periods DELETED · other punctuation to
 * a space · whitespace collapsed.
 *
 * The apostrophe rule is load-bearing on this dataset and was found by the
 * proof harness, not by reading: replacing it with a space turns "Dominique's"
 * into "dominique s" while a scraped "Dominiques" becomes "dominiques", and the
 * two stop keying alike. Nearly every restaurant on the Baton Rouge list is
 * possessive — Dee's, Dominique's, Lillie's, Ethel's, Dorothy's, Linda's,
 * Bayou Belle's — so a space here would have made the exact-name rule refuse to
 * adopt almost everything and quietly doubled the pins instead.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Business-name key. Exact equality after normalization or nothing — see the
 * "deliberately exact" note above.
 */
export function nameKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalizeText(name);
  return key.length > 0 ? key : null;
}

/** Two names are the same business only if both exist and key identically. */
export function namesAgree(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  return ka !== null && kb !== null && ka === kb;
}

/**
 * Address key: house number · street core · ZIP.
 *
 * Chosen because these three are the parts a caller CANNOT lose — they survive
 * a scrape, a retype and a format drift between systems, while "1462 Airline
 * Hwy" vs "1462 Airline Highway, Baton Rouge, LA 70805" defeats string
 * equality. Suite/unit is dropped on purpose: two suites at one street address
 * ARE one address, and it is the NAME that separates the businesses there.
 *
 * Returns null rather than a partial key when the house number is missing — a
 * key made only of a street name would match an entire block. A missing key
 * means "no address decision available," never "matches everything."
 */
export function addressKey(address: string | null | undefined): string | null {
  if (!address) return null;
  const normalized = normalizeText(address);
  const houseNumber = normalized.match(/^(\d+)\b/)?.[1];
  if (!houseNumber) return null;

  const zip = normalized.match(/\b(\d{5})\b(?!.*\b\d{5}\b)/)?.[1] ?? "";

  // Street core = the first comma-free segment, minus the number, minus any
  // unit designator and its value, with the street type canonicalized.
  const firstSegment = normalizeText(address.split(",")[0] ?? "");
  const words = firstSegment.split(" ").slice(1);
  const core: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (UNIT_WORDS.has(word)) {
      i += 1; // drop the designator and the unit value that follows it
      continue;
    }
    core.push(STREET_SUFFIXES[word] ?? word);
  }
  if (core.length === 0) return null;

  return `${houseNumber}|${core.join(" ")}|${zip}`;
}

/** Same street address (suite-insensitive). Null keys never match anything. */
export function addressesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = addressKey(a);
  const kb = addressKey(b);
  return ka !== null && kb !== null && ka === kb;
}

/**
 * Decide what to do with an incoming spine restaurant given every stored lead
 * that could plausibly be at its address.
 *
 * `candidates` is expected to be a cheap SUPERSET from the database (a house
 * number prefix scan) — this function does the exact filtering, because the
 * decision must not depend on how clever the query was.
 */
export function decideAdoption(
  incoming: { externalRef: string; name: string | null; address: string | null },
  candidates: CandidateLead[],
): AdoptDecision {
  const atAddress = candidates.filter((c) => addressesMatch(c.address, incoming.address));
  if (atAddress.length === 0) return { verdict: "create", alongside: [] };

  const samePlace = atAddress.filter((c) => namesAgree(c.customer_name, incoming.name));
  const neighbours = atAddress.filter((c) => !samePlace.includes(c));

  // Same address, different name: genuinely a different business. Create, and
  // hand back who it is next door so the caller can say so.
  if (samePlace.length === 0) return { verdict: "create", alongside: neighbours };

  // This place is already here under a different upstream ref. Neither branch
  // available to us is safe, so we take neither.
  const claimed = samePlace.filter((c) => c.external_ref !== null && c.external_ref !== incoming.externalRef);
  if (claimed.length > 0) {
    return { verdict: "refuse", reason: "duplicate_external_ref", neighbours: claimed };
  }

  if (samePlace.length > 1) {
    return { verdict: "refuse", reason: "ambiguous_address", neighbours: samePlace };
  }

  return { verdict: "adopt", lead: samePlace[0] };
}

/**
 * The house-number prefix used to pull candidates out of the database. Cheap,
 * index-friendly, and deliberately WIDER than the real key — narrowing happens
 * in decideAdoption where it can be tested without a database.
 */
export function candidatePrefix(address: string | null | undefined): string | null {
  if (!address) return null;
  const houseNumber = address.trim().match(/^(\d+)\b/)?.[1];
  return houseNumber ?? null;
}
