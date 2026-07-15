import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/geocode";
import {
  ANSWERS_SOURCE,
  fetchAnswersPipeline,
  mapLifecycleToRouxteStatus,
  type AnswersPipelineRestaurant,
} from "@/lib/answers/client";

/**
 * GET /api/cron/answers-sync
 * Vercel cron — pulls the Anseur (Answers) restaurant pipeline and upserts
 * leads keyed on external_ref = Answers restaurant_id.
 *
 * Rules (per rouxte-web#1 / rouxte-web#2):
 *  - Match on (org, external_source='answers', external_ref) first; else adopt
 *    an existing address-matched lead that has no external_ref yet (covers
 *    leads imported manually before the sync shipped); else insert.
 *  - New leads are created only for lifecycle lead/audited/pitched — Answers
 *    customers already live/onboarding don't become fresh door-knock leads.
 *  - Answers wins on status only while the Rouxte lead is untouched
 *    (status='new'); once a rep works it, Rouxte is authoritative until sold.
 *  - name/address/phone always refresh from Answers (system of record).
 *  - Leads missing coords are geocoded so they land on the rep map.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = process.env.ANSWERS_TARGET_ORG_ID;
  if (!orgId) {
    return NextResponse.json({ error: "ANSWERS_TARGET_ORG_ID is not set" }, { status: 500 });
  }

  let pipeline: AnswersPipelineRestaurant[];
  try {
    pipeline = await fetchAnswersPipeline();
  } catch (err) {
    const message = err instanceof Error ? err.message : "pipeline fetch failed";
    console.error("[answers-sync]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();

  // created_by is required on leads — attribute cron-created leads to an org admin
  const { data: orgAdmin } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (!orgAdmin) {
    return NextResponse.json({ error: `No admin profile found for org ${orgId}` }, { status: 500 });
  }

  const summary = { created: 0, updated: 0, adopted: 0, geocoded: 0, status_changed: 0, skipped: 0 };
  const errors: string[] = [];

  for (const r of pipeline) {
    try {
      if (!r.id) continue;

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

        // Answers wins on status only for untouched leads
        const statusChanging = target.status === "new" && mappedStatus !== "new" && mappedStatus !== target.status;
        if (statusChanging) patch.status = mappedStatus;

        // Backfill coords if the stored lead never got any
        if (target.lat == null && r.address) {
          const coords = await geocodeAddress(r.address);
          if (coords) {
            patch.lat = coords.lat;
            patch.lng = coords.lng;
            summary.geocoded++;
          }
        }

        const { error: updateErr } = await admin.from("leads").update(patch).eq("id", target.id);
        if (updateErr) throw new Error(updateErr.message);

        if (statusChanging) {
          summary.status_changed++;
          await admin.from("lead_status_history").insert({
            lead_id: target.id,
            from_status: "new",
            to_status: mappedStatus,
            changed_by: orgAdmin.user_id,
          });
          await admin.from("sales_activity_log").insert({
            org_id: orgId,
            lead_id: target.id,
            actor_id: orgAdmin.user_id,
            event_type: "status_changed",
            summary: `Status synced from Anseur pipeline: new → ${mappedStatus} (lifecycle: ${r.lifecycle_status})`,
            metadata: { from: "new", to: mappedStatus, answers_lifecycle: r.lifecycle_status, sync: true },
            is_incident: false,
          });
        }

        if (adopted) summary.adopted++;
        else summary.updated++;
        continue;
      }

      // 3. Insert — only pipeline stages that a rep should actually work
      if (!["lead", "audited", "pitched"].includes(r.lifecycle_status)) {
        summary.skipped++;
        continue;
      }
      if (!r.address) {
        summary.skipped++;
        errors.push(`${r.id} (${r.name}): no address, skipped`);
        continue;
      }

      const coords = await geocodeAddress(r.address);
      if (coords) summary.geocoded++;

      const { error: insertErr } = await admin.from("leads").insert({
        org_id: orgId,
        created_by: orgAdmin.user_id,
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
      });
      if (insertErr) throw new Error(insertErr.message);
      summary.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${r.id} (${r.name}): ${message}`);
    }
  }

  const result = { ok: errors.length === 0, pulled: pipeline.length, ...summary, errors };
  console.log("[answers-sync]", JSON.stringify(result));
  return NextResponse.json(result);
}
