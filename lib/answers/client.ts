// Server-only client for the Anseur flagship API (internal name "answers" —
// per the 2026-07 rebrand, technical identifiers stay "answers"; only
// rep-facing UI copy says "Anseur"). Contract: PIPELINE-ROLES.md in
// alpuckett26/restaurant-ai-ordering.

import type { LeadStatus } from "@/lib/types";

export const ANSWERS_SOURCE = "answers";

/** "Everything the spine has" — see fetchProvisionLeads. */
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

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
 * One-shot backfill feed (rouxte-web#7): leads already sourced on the spine,
 * from GET /internal/provision/leads?since=<iso>. Returns raw records —
 * callers normalize with normalizeAnswersLeadPayload (the endpoint's item
 * shape may be either the pipeline shape or the push-rail profile shape).
 */
export async function fetchProvisionLeads(since?: string): Promise<unknown[]> {
  // MEASURED 2026-08-14 (rouxte-web#16): omitting `since` does NOT mean "all".
  // GET /internal/provision/leads with no query returns `[]` at HTTP 200,
  // while ?since=2026-01-01T00:00:00Z returns the full 29. An operator running
  // the backfill the obvious way (no ?since=) therefore got a green
  // {"ok":true,"pulled":0} that loaded nothing — a silent zero, and the direct
  // cause of the 0-row insert pass. Default to the epoch so "no since" means
  // what every caller reads it to mean.
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
  if (Array.isArray(data)) return data;
  return data.leads ?? data.data ?? [];
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
