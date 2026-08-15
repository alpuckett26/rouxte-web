// Shared Answers → Rouxte lead upsert. One implementation of the sync rules
// (rouxte-web#1 / rouxte-web#2), used by both the 15-min pull cron
// (/api/cron/answers-sync) and the push rail (/api/answers/load, rouxte-web#7):
//  - Match on (org, external_source='answers', external_ref) first; else run
//    the adopt gate over every stored lead at that street address
//    (lib/answers/addressIdentity.ts) — adopt / create / refuse; else insert.
//  - New leads are created only for lifecycle lead/audited/pitched.
//  - Answers wins on status only while the Rouxte lead is untouched
//    (status='new'); once a rep works it, Rouxte is authoritative until sold.
//  - name/address/phone always refresh from Answers (system of record).
//  - Leads missing coords are geocoded so they land on the rep map.

import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/geocode";
import {
  ANSWERS_SOURCE,
  mapLifecycleToRouxteStatus,
  type AnswersPipelineRestaurant,
} from "@/lib/answers/client";
import {
  candidatePrefix,
  decideAdoption,
  type CandidateLead,
} from "@/lib/answers/addressIdentity";

export interface UpsertAnswersLeadResult {
  /**
   * "refused" is a deliberate outcome, not an error: the sync could not be
   * certain which stored lead this place is, so it wrote nothing. It is
   * reported rather than thrown because a refusal is information for the room,
   * not a failure of the rail — but it must never be silent, which is why the
   * routes surface it.
   */
  action: "created" | "updated" | "adopted" | "skipped" | "refused";
  leadId?: string;
  statusChanged: boolean;
  geocoded: boolean;
  reason?: string;
  /** Rows that caused a refusal, or that a create landed alongside. */
  conflicts?: { leadId: string; externalRef: string | null; name: string | null }[];
}

export interface UpsertAnswersLeadOptions {
  /**
   * Override a duplicate_external_ref refusal and create the second lead
   * anyway — the caller asserting these really are two businesses. Mirrors the
   * spine's allow_duplicate opt-in, and like it, the override is RECORDED
   * (result.conflicts names what was overridden) rather than merely permitted.
   * It cannot force an ambiguous_address adopt: no assertion from a caller
   * tells us WHICH of two rows to pick.
   */
  allowDuplicate?: boolean;
}

/**
 * Normalize an Answers lead payload into the pipeline-restaurant shape.
 * Tolerates both the pipeline-endpoint shape ({ id, name, phone_number,
 * address, ... }) and the push-rail / provision shape
 * ({ external_ref, slug, profile: { name, phone, address, brand } }).
 * Returns null when no external ref is present.
 */
export function normalizeAnswersLeadPayload(raw: unknown): AnswersPipelineRestaurant | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const profile = (body.profile ?? {}) as Record<string, unknown>;

  const id = body.external_ref ?? body.restaurant_id ?? body.id;
  if (typeof id !== "string" || !id) return null;

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

  return {
    id,
    name: str(profile.name) ?? str(body.name) ?? "",
    slug: str(body.slug) ?? "",
    lifecycle_status:
      (str(body.lifecycle_status) as AnswersPipelineRestaurant["lifecycle_status"]) ?? "lead",
    lifecycle_status_changed_at: str(body.lifecycle_status_changed_at),
    created_at: str(body.created_at) ?? new Date().toISOString(),
    assigned_to: str(body.assigned_to),
    address: str(profile.address) ?? str(body.address),
    // MEASURED 2026-08-14 (rouxte-web#16): /internal/provision/leads emits the
    // key `phone`, not `phone_number` and not `profile.phone` — so every lead
    // the backfill pulled was landing with phone = null. A phoneless lead in a
    // door-knock CRM is a rep who can't call ahead.
    phone_number: str(profile.phone) ?? str(body.phone_number) ?? str(body.phone),
    source_channel: str(body.src) ?? str(body.source_channel),
  };
}

/**
 * Attribution token, validated to the charset the print lane ruled
 * (alnum, 4–32). Anything else is dropped rather than stored — a junk token in
 * the column is worse than a null, because it reads as real attribution.
 */
function cleanSourceChannel(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.trim();
  return /^[A-Za-z0-9]{4,32}$/.test(token) ? token : null;
}

/** Upsert one Answers restaurant into the org's leads. Throws on DB errors. */
export async function upsertAnswersLead(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  createdBy: string,
  r: AnswersPipelineRestaurant,
  options: UpsertAnswersLeadOptions = {},
): Promise<UpsertAnswersLeadResult> {
  const result: UpsertAnswersLeadResult = { action: "skipped", statusChanged: false, geocoded: false };
  const CANDIDATE_COLUMNS =
    "id, status, lat, lng, assigned_to, address, customer_name, external_ref, external_source";
  /**
   * Cap on the house-number candidate scan. Sized to be unreachable in normal
   * data (it would take 200 stored leads whose address starts with the same
   * house number, inside one org) so that hitting it is a signal, not a
   * routine truncation — see the saturation check below.
   */
  const CANDIDATE_SCAN_LIMIT = 200;

  // 1. Match on external_ref
  const { data: existing } = await admin
    .from("leads")
    .select(CANDIDATE_COLUMNS)
    .eq("org_id", orgId)
    .eq("external_source", ANSWERS_SOURCE)
    .eq("external_ref", r.id)
    .maybeSingle();

  // 2. The adopt gate. Pull every stored lead that could be at this street
  //    address — a house-number prefix, which is a cheap SUPERSET — and let
  //    decideAdoption do the exact filtering. The query is deliberately dumb:
  //    the old one was clever (a street-line prefix with limit(1)) and that is
  //    precisely how it adopted the wrong row, because a query that returns one
  //    row cannot tell "the only match" from "one of several."
  //
  //    Note the scan is NOT filtered to external_ref IS NULL any more. That
  //    filter made already-synced leads invisible here, so a second spine row
  //    for a place we already hold fell straight through to the insert and gave
  //    the rep two pins. We need to SEE those rows in order to refuse.
  let adopted: CandidateLead | null = null;
  if (!existing && r.address) {
    const prefix = candidatePrefix(r.address);
    if (prefix) {
      const { data: candidates } = await admin
        .from("leads")
        .select(CANDIDATE_COLUMNS)
        .eq("org_id", orgId)
        .ilike("address", `${prefix}%`)
        .limit(CANDIDATE_SCAN_LIMIT);

      const rows = (candidates ?? []) as CandidateLead[];

      // A SATURATED SCAN IS NOT A RESULT. The prefix is only a house number, so
      // "100%" also pulls 1000, 10012, 100th — in a dense org this can hit the
      // limit, and a truncated superset breaks decideAdoption's one premise:
      // that it was handed EVERY row that could be this place. The row it never
      // saw is exactly the one that would have made an adopt ambiguous.
      //
      // This is the silent-zero shape again — a query returning a plausible
      // answer that is quietly incomplete — so it gets the same treatment:
      // refuse, out loud, naming the cap. It is rare by construction, and a
      // refusal costs a pin that a human can add; a wrong adopt costs a rep's
      // worked lead and cannot be undone.
      if (rows.length >= CANDIDATE_SCAN_LIMIT) {
        result.action = "refused";
        result.reason =
          `ambiguous_address: the candidate scan for house number "${prefix}" hit its ` +
          `${CANDIDATE_SCAN_LIMIT}-row cap, so the address decision was made on a truncated set. ` +
          `Refusing rather than adopting against rows we could not see.`;
        result.conflicts = rows
          .slice(0, 5)
          .map((c) => ({ leadId: c.id, externalRef: c.external_ref, name: c.customer_name }));
        return result;
      }

      const decision = decideAdoption(
        { externalRef: r.id, name: r.name ?? null, address: r.address },
        rows,
      );

      const describe = (rows: CandidateLead[]) =>
        rows.map((c) => ({ leadId: c.id, externalRef: c.external_ref, name: c.customer_name }));

      if (decision.verdict === "refuse") {
        const overridable = decision.reason === "duplicate_external_ref" && options.allowDuplicate === true;
        if (!overridable) {
          result.action = "refused";
          result.reason =
            decision.reason === "duplicate_external_ref"
              ? `duplicate_external_ref: this address already holds "${decision.neighbours[0].customer_name}" ` +
                `under external_ref ${decision.neighbours[0].external_ref} (lead ${decision.neighbours[0].id}). ` +
                `Neither creating a second pin nor re-pointing that ref is safe; pass allowDuplicate to force a create.`
              : `ambiguous_address: ${decision.neighbours.length} stored leads could be this place ` +
                `(${decision.neighbours.map((c) => c.id).join(", ")}). Refusing rather than picking one.`;
          result.conflicts = describe(decision.neighbours);
          return result;
        }
        // Overridden: fall through to insert, but keep what was overridden.
        result.conflicts = describe(decision.neighbours);
        result.reason = `allowDuplicate: created alongside ${decision.neighbours.map((c) => c.id).join(", ")}`;
      } else if (decision.verdict === "adopt") {
        adopted = decision.lead;
      } else if (decision.alongside.length > 0) {
        // Same address, different business — correct to create, but say so.
        result.conflicts = describe(decision.alongside);
        result.reason = `same address as ${decision.alongside.map((c) => `"${c.customer_name}"`).join(", ")}, different name — created separately`;
      }
    }
  }

  const target = (existing as CandidateLead | null) ?? adopted;
  const mappedStatus = mapLifecycleToRouxteStatus(r.lifecycle_status);

  if (target) {
    const patch: Record<string, unknown> = {
      external_source: ANSWERS_SOURCE,
      external_ref: r.id,
      customer_name: r.name ?? null,
      phone: r.phone_number ?? null,
      updated_at: new Date().toISOString(),
    };
    if (r.address) patch.address = r.address.trim();
    // Only written when the payload actually carries a token — so this stays a
    // no-op until the spine forwards `src`, and never overwrites a known
    // channel with a null on a later sync.
    const channel = cleanSourceChannel(r.source_channel);
    if (channel) patch.source_channel = channel;

    // Answers wins on status only for untouched leads. (The old third clause
    // `mappedStatus !== target.status` was unreachable — target.status is
    // already known to be "new" here and mappedStatus is already known not to
    // be.)
    const statusChanging = target.status === "new" && mappedStatus !== "new";
    if (statusChanging) patch.status = mappedStatus;

    // Backfill coords if the stored lead never got any
    if (target.lat == null && r.address) {
      const coords = await geocodeAddress(r.address);
      if (coords) {
        patch.lat = coords.lat;
        patch.lng = coords.lng;
        result.geocoded = true;
      }
    }

    const { error: updateErr } = await admin.from("leads").update(patch).eq("id", target.id);
    if (updateErr) throw new Error(updateErr.message);

    if (statusChanging) {
      result.statusChanged = true;
      await admin.from("lead_status_history").insert({
        lead_id: target.id,
        from_status: "new",
        to_status: mappedStatus,
        changed_by: createdBy,
      });
      await admin.from("sales_activity_log").insert({
        org_id: orgId,
        lead_id: target.id,
        actor_id: createdBy,
        event_type: "status_changed",
        summary: `Status synced from Anseur pipeline: new → ${mappedStatus} (lifecycle: ${r.lifecycle_status})`,
        metadata: { from: "new", to: mappedStatus, answers_lifecycle: r.lifecycle_status, sync: true },
        is_incident: false,
      });
    }

    result.action = adopted ? "adopted" : "updated";
    result.leadId = target.id;
    return result;
  }

  // 3. Insert — only pipeline stages that a rep should actually work
  if (!["lead", "audited", "pitched"].includes(r.lifecycle_status)) {
    return result;
  }
  if (!r.address) {
    result.reason = "no address, skipped";
    return result;
  }

  const coords = await geocodeAddress(r.address);
  if (coords) result.geocoded = true;

  const insertChannel = cleanSourceChannel(r.source_channel);

  const { data: inserted, error: insertErr } = await admin
    .from("leads")
    .insert({
      org_id: orgId,
      created_by: createdBy,
      address: r.address.trim(),
      customer_name: r.name ?? null,
      phone: r.phone_number ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      carrier_availability: {},
      status: mappedStatus,
      source: ANSWERS_SOURCE,
      external_source: ANSWERS_SOURCE,
      external_ref: r.id,
      ...(insertChannel ? { source_channel: insertChannel } : {}),
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  result.action = "created";
  result.leadId = inserted?.id;
  return result;
}

/**
 * Resolve the org admin used as created_by/actor for system-created leads.
 * Throws if the org has no admin profile.
 */
export async function resolveOrgAdmin(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<string> {
  const { data: orgAdmin } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (!orgAdmin) throw new Error(`No admin profile found for org ${orgId}`);
  return orgAdmin.user_id;
}
