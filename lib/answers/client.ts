// Server-only client for the Anseur flagship API (internal name "answers" —
// per the 2026-07 rebrand, technical identifiers stay "answers"; only
// rep-facing UI copy says "Anseur"). Contract: PIPELINE-ROLES.md in
// alpuckett26/restaurant-ai-ordering.

import type { LeadStatus } from "@/lib/types";

export const ANSWERS_SOURCE = "answers";

/** "Everything the spine has" — see fetchProvisionLeads. */
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

/**
 * The contact the spine sourced for a restaurant (rouxte-web#18).
 *
 * MEASURED 2026-08-16 against the live feed: of 31 records, 2 carry a contact
 * and the keys actually present are name/email/source/verified/sourced_at. The
 * contract also documents `role`, `phone` and `do_not_contact`; they are typed
 * optional here because the spine omits null keys, and a key that never appears
 * on the wire must never be read as `false`. In particular ABSENT
 * `do_not_contact` MEANS UNKNOWN, NOT ALLOWED — see normalizeAnswersContact.
 */
export interface AnswersContact {
  name?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  /** WHERE the contact came from. Without it we cannot answer "why did you email me". */
  source?: string | null;
  sourced_at?: string | null;
  verified?: boolean | null;
  do_not_contact?: boolean | null;
}

/** Open-ended sourcing signals, e.g. `{ gloriafood: {...} }`. */
export type AnswersSignals = Record<string, unknown>;

export interface AnswersPipelineRestaurant {
  id: string;
  name: string;
  slug: string;
  lifecycle_status: "lead" | "audited" | "pitched" | "onboarding" | "live" | "churned";
  lifecycle_status_changed_at: string | null;
  created_at: string;
  assigned_to: string | null;
  address: string | null;
  phone_number: string | null;
  /** Attribution token if the spine forwards one (see migration 040). */
  source_channel?: string | null;
  contact?: AnswersContact | null;
  signals?: AnswersSignals | null;
}

/**
 * Rouxte → Answers push mapping. Only rep milestones that mean something to
 * the flagship pipeline push back; everything else is Rouxte-internal.
 */
export function mapRouxteStatusToLifecycle(status: LeadStatus): string | null {
  switch (status) {
    case "sold":
      return "onboarding";
    case "interested":
    case "appointment":
      return "pitched";
    default:
      // 'attempted' is visit-tracking only; 'lost' stays 'lead' in Answers
      // (flag for re-audit, never auto-churn); 'new' pushes nothing.
      return null;
  }
}

/** Answers → Rouxte pull mapping (applied only to leads Rouxte hasn't worked). */
export function mapLifecycleToRouxteStatus(lifecycle: string): LeadStatus {
  switch (lifecycle) {
    case "pitched":
      return "interested";
    case "onboarding":
    case "live":
      return "sold";
    case "churned":
      return "lost";
    default: // 'lead', 'audited'
      return "new";
  }
}

function baseUrl(): string {
  const url = process.env.ANSWERS_API_URL;
  if (!url) throw new Error("ANSWERS_API_URL is not set");
  return url.replace(/\/$/, "");
}

/**
 * Auth: prefer the platform-standard X-Internal-Secret service lane when
 * ANSWERS_INTERNAL_SECRET is set; fall back to an admin JWT
 * (ANSWERS_ADMIN_TOKEN) until Answers exposes the service lane.
 */
function authHeaders(): Record<string, string> {
  const secret = process.env.ANSWERS_INTERNAL_SECRET;
  if (secret) return { "X-Internal-Secret": secret };
  const token = process.env.ANSWERS_ADMIN_TOKEN;
  if (token) return { Authorization: `Bearer ${token}` };
  throw new Error("Neither ANSWERS_INTERNAL_SECRET nor ANSWERS_ADMIN_TOKEN is set");
}

export async function fetchAnswersPipeline(): Promise<AnswersPipelineRestaurant[]> {
  const res = await fetch(`${baseUrl()}/admin/restaurants/pipeline`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Answers pipeline fetch failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  // Endpoint may return a bare array or { data: [...] }
  return Array.isArray(data) ? data : (data.data ?? []);
}

/**
 * What the spine says about the feed it just served (X-Feed-* headers, added
 * spine-side 2026-08-15 in e26f0cf). Every field is nullable because the
 * headers are additive and an older deploy simply will not send them — absent
 * means UNKNOWN, never false. Claiming "not truncated" from a missing header
 * is the same mistake as reading a green zero as a loaded zero.
 */
export interface ProvisionFeedMeta {
  since: string | null;
  sinceDefaulted: boolean | null;
  count: number | null;
  limit: number | null;
  truncated: boolean | null;
}

/**
 * One-shot backfill feed (rouxte-web#7): leads already sourced on the spine,
 * from GET /internal/provision/leads?since=<iso>. Returns raw records —
 * callers normalize with normalizeAnswersLeadPayload (the endpoint's item
 * shape may be either the pipeline shape or the push-rail profile shape) —
 * alongside the feed metadata, which callers must not drop on the floor.
 */
export async function fetchProvisionLeads(
  since?: string,
): Promise<{ leads: unknown[]; meta: ProvisionFeedMeta }> {
  // MEASURED 2026-08-14 (rouxte-web#16), ROOT CAUSE since supplied by the spine
  // (captain, 2026-08-15 e26f0cf): omitting `since` did not mean "all" — it
  // defaulted to the LAST 24 HOURS, and every lead the spine holds is older
  // than that, so the call returned `[]` at HTTP 200 while ?since=2026-01-01
  // returned the full 29. An operator running the backfill the obvious way got
  // a green {"ok":true,"pulled":0} that loaded nothing — the direct cause of
  // the 0-row insert pass. The spine's default is the epoch now; this stays
  // explicit anyway, because a rail that depends on someone else's default
  // being right is a rail that breaks quietly when it changes back.
  const qs = `?since=${encodeURIComponent(since ?? EPOCH_ISO)}`;
  const res = await fetch(`${baseUrl()}/internal/provision/leads${qs}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Answers provision leads fetch failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const leads: unknown[] = Array.isArray(data) ? data : (data.leads ?? data.data ?? []);

  const header = (name: string): string | null => res.headers.get(name);
  const num = (name: string): number | null => {
    const raw = header(name);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (name: string): boolean | null => {
    const raw = header(name);
    return raw === null ? null : raw.toLowerCase() === "true";
  };

  const count = num("X-Feed-Count");
  const limit = num("X-Feed-Limit");
  return {
    leads,
    meta: {
      since: header("X-Feed-Since"),
      sinceDefaulted: bool("X-Feed-Since-Defaulted"),
      count,
      limit,
      // Trust the spine's own flag; fall back to the count/limit comparison so
      // a truncation is still caught if only some headers land.
      truncated: bool("X-Feed-Truncated") ?? (count !== null && limit !== null ? count >= limit : null),
    },
  };
}

/** One entry of GET /internal/provision/segment. */
export interface AnswersSegmentMember {
  restaurant_id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  contact?: AnswersContact | null;
  signals?: AnswersSignals | null;
  [key: string]: unknown;
}

export interface AnswersSegment {
  signal: string;
  /** How many records carry the signal at all. */
  tagged: number;
  /** How many of those the spine considers contactable. */
  contactable: number;
  restaurants: AnswersSegmentMember[];
}

/**
 * GET /internal/provision/segment?signal=<s>[&contactable=1] — THE cohort.
 *
 * Read rather than derived, on the captain's instruction and for a reason
 * Rouxte already argued in its own lane when it built the C3 gate on set
 * membership instead of names: four rails each deriving "who is in the
 * GloriaFood cohort" is four rails disagreeing quietly, with nobody able to say
 * which one is right. `leads.signals` is a MIRROR for local filtering and
 * display; it is never the source of the list.
 *
 * MEASURED 2026-08-16: signal=gloriafood → {tagged: 0, contactable: 0}; the
 * same for owner_com. The endpoint is live and correct; the cohort is empty
 * because no record carries a signal yet.
 */
export async function fetchProvisionSegment(
  signal: string,
  options: { contactableOnly?: boolean } = {},
): Promise<AnswersSegment> {
  const qs = new URLSearchParams({ signal });
  if (options.contactableOnly) qs.set("contactable", "1");

  const res = await fetch(`${baseUrl()}/internal/provision/segment?${qs}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Answers segment fetch failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const restaurants: AnswersSegmentMember[] = Array.isArray(data)
    ? data
    : (data.restaurants ?? data.data ?? []);
  return {
    signal: typeof data?.signal === "string" ? data.signal : signal,
    // Counts come from the spine when it sends them; falling back to the array
    // length is fine for `restaurants` but NOT for `tagged`, which counts rows
    // the contactable filter removed. Absent means unknown, so it reports -1
    // rather than a number that reads as measured.
    tagged: typeof data?.tagged === "number" ? data.tagged : -1,
    contactable: typeof data?.contactable === "number" ? data.contactable : restaurants.length,
    restaurants,
  };
}

/**
 * Push a lifecycle stage (and optionally the owning rep) back to the Answers
 * restaurant record. Best-effort: callers should treat failure as non-fatal —
 * the sync cron reconciles drift.
 */
export async function pushAnswersLifecycle(
  restaurantId: string,
  lifecycleStatus: string,
  assignedTo?: string | null,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { lifecycle_status: lifecycleStatus };
    if (assignedTo) body.assigned_to = assignedTo;

    const res = await fetch(`${baseUrl()}/admin/restaurants/${restaurantId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[answers] lifecycle push failed for ${restaurantId}: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[answers] lifecycle push error for ${restaurantId}:`, err);
    return false;
  }
}
