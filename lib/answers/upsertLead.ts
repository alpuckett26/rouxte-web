// Shared Answers → Rouxte lead upsert. One implementation of the sync rules
// (rouxte-web#1 / rouxte-web#2), used by both the 15-min pull cron
// (/api/cron/answers-sync) and the push rail (/api/answers/load, rouxte-web#7):
//  - Match on (org, external_source='answers', external_ref) first; else adopt
//    an existing address-matched lead that has no external_ref yet; else insert.
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

export interface UpsertAnswersLeadResult {
  action: "created" | "updated" | "adopted" | "skipped";
  leadId?: string;
  statusChanged: boolean;
  geocoded: boolean;
  reason?: string;
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
): Promise<UpsertAnswersLeadResult> {
  const result: UpsertAnswersLeadResult = { action: "skipped", statusChanged: false, geocoded: false };

  // 1. Match on external_ref
  const { data: existing } = await admin
    .from("leads")
    .select("id, status, lat, lng, assigned_to")
    .eq("org_id", orgId)
    .eq("external_source", ANSWERS_SOURCE)
    .eq("external_ref", r.id)
    .maybeSingle();

  // 2. Adopt an address-matched lead that predates the sync
  let adopted: { id: string; status: string; lat: number | null; lng: number | null; assigned_to: string | null } | null = null;
  if (!existing && r.address) {
    const { data: byAddress } = await admin
      .from("leads")
      .select("id, status, lat, lng, assigned_to")
      .eq("org_id", orgId)
      .is("external_ref", null)
      .ilike("address", r.address.trim())
      .limit(1)
      .maybeSingle();
    adopted = byAddress ?? null;

    // Formats drift between systems ("… Baton Rouge 70805" vs
    // "… Baton Rouge, LA 70805") — fall back to the street line, which is
    // unique enough within a single org's territory.
    if (!adopted) {
      const streetLine = r.address.split(",")[0].trim();
      if (streetLine.length >= 8) {
        const { data: byStreet } = await admin
          .from("leads")
          .select("id, status, lat, lng, assigned_to")
          .eq("org_id", orgId)
          .is("external_ref", null)
          .ilike("address", `${streetLine}%`)
          .limit(1)
          .maybeSingle();
        adopted = byStreet ?? null;
      }
    }
  }

  const target = existing ?? adopted;
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

    // Answers wins on status only for untouched leads
    const statusChanging = target.status === "new" && mappedStatus !== "new" && mappedStatus !== target.status;
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
