import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeBatch } from "@/lib/geocode";

interface ImportRow {
  address: string;
  customer_name?: string;
  phone?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
  source?: string;
  external_source?: string;
  external_ref?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  if (!["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const rows: ImportRow[] = body.rows ?? [];

  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "Max 5000 rows per import" }, { status: 400 });

  // Optionally assign every imported lead to the importer (e.g. a manager
  // loading their own pipeline). Bulk import intentionally skips per-lead
  // assignment activity logs.
  const assignFields = body.assign_to_me
    ? { assigned_to: user.id, assigned_at: new Date().toISOString() }
    : {};

  const inserts = rows.map((row) => ({
    org_id: profile.org_id,
    created_by: user.id,
    address: row.address.trim(),
    customer_name: row.customer_name?.trim() || null,
    phone: row.phone?.trim() || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    carrier_availability: {},
    status: "new" as const,
    source: row.source?.trim() || "import",
    external_source: row.external_source?.trim() || null,
    external_ref: row.external_ref?.trim() || null,
    ...assignFields,
  }));

  // Geocode rows missing coordinates so imported leads land on the map.
  // Best-effort and capped — rows that fail to geocode still import.
  const missingCoords = inserts
    .map((row, index) => ({ index, address: row.address }))
    .filter(({ index }) => inserts[index].lat == null || inserts[index].lng == null);
  if (missingCoords.length) {
    const geocoded = await geocodeBatch(missingCoords);
    for (const [index, coords] of geocoded) {
      inserts[index].lat = coords.lat;
      inserts[index].lng = coords.lng;
    }
  }

  // Rows carrying an external_ref (cross-system sync) dedupe on
  // (org_id, external_source, external_ref); everything else keeps the
  // (org_id, address) upsert for organic imports.
  const refInserts = inserts.filter((r) => r.external_ref != null);
  const plainInserts = inserts.filter((r) => r.external_ref == null);

  let savedData: { id: string; lat: number | null; lng: number | null }[] = [];

  if (plainInserts.length) {
    // Upsert so that re-importing the same area doesn't fail on duplicate addresses.
    // ignoreDuplicates silently skips rows whose (org_id, address) already exist.
    const { data, error } = await admin
      .from("leads")
      .upsert(plainInserts, { onConflict: "org_id,address", ignoreDuplicates: true })
      .select("id, lat, lng");

    if (error) {
      // Constraint may not exist in all environments — fall back to plain insert
      const { data: insertData, error: insertError } = await admin
        .from("leads")
        .insert(plainInserts)
        .select("id, lat, lng");
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      savedData = insertData ?? [];
    } else {
      savedData = data ?? [];
    }
  }

  for (const row of refInserts) {
    const { data: existing } = await admin
      .from("leads")
      .select("id, lat, lng")
      .eq("org_id", row.org_id)
      .eq("external_source", row.external_source!)
      .eq("external_ref", row.external_ref!)
      .maybeSingle();
    if (existing) continue; // already synced — skip, same as ignoreDuplicates

    const { data: inserted, error: insertError } = await admin
      .from("leads")
      .insert(row)
      .select("id, lat, lng")
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    if (inserted) savedData.push(inserted);
  }

  // Log notes as lead notes if provided
  if (body.notes_map) {
    const notesMap: Record<number, string> = body.notes_map;
    const noteInserts = savedData
      .map((lead, i) => notesMap[i] ? { lead_id: lead.id, author_id: user.id, body: notesMap[i] } : null)
      .filter(Boolean);
    if (noteInserts.length) {
      await admin.from("lead_notes").insert(noteInserts);
    }
  }

  // Batch-check AT&T fiber availability for leads with coordinates
  const coordPairs = savedData
    .map((row) => ({ id: row.id, lat: row.lat, lng: row.lng }))
    .filter((r): r is { id: string; lat: number; lng: number } => r.lat != null && r.lng != null);

  if (coordPairs.length) {
    try {
      const { data: fccResults, error: fccErr } = await admin.rpc("batch_fcc_check", {
        points_json: JSON.stringify(coordPairs.map((r) => ({ lat: r.lat, lng: r.lng }))),
      });

      const results: boolean[] =
        !fccErr && Array.isArray(fccResults)
          ? fccResults
          : await Promise.all(
              coordPairs.map(async (r) => {
                try {
                  const { data: d } = await admin.rpc("fcc_att_available", { p_lat: r.lat, p_lng: r.lng });
                  return !!d;
                } catch {
                  return false;
                }
              }),
            );

      const attIds = coordPairs.filter((_, i) => results[i] === true).map((r) => r.id);
      if (attIds.length) {
        await admin.from("leads").update({ carrier_availability: { att: true } }).in("id", attIds);
      }
    } catch {
      // Non-fatal: FCC check failure doesn't block import success
    }
  }

  return NextResponse.json({ imported: savedData.length, lead_ids: savedData.map((r) => r.id) });
}
