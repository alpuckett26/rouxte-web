import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ImportRow {
  address: string;
  customer_name?: string;
  phone?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
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
    source: "import",
  }));

  // Upsert so that re-importing the same area doesn't fail on duplicate addresses.
  // ignoreDuplicates silently skips rows whose (org_id, address) already exist.
  const { data, error } = await admin
    .from("leads")
    .upsert(inserts, { onConflict: "org_id,address", ignoreDuplicates: true })
    .select("id");

  if (error) {
    // Constraint may not exist in all environments — fall back to plain insert
    const { data: insertData, error: insertError } = await admin
      .from("leads")
      .insert(inserts)
      .select("id");
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ imported: insertData?.length ?? 0, lead_ids: (insertData ?? []).map((r) => r.id) });
  }

  // Log notes as lead notes if provided
  if (body.notes_map) {
    const notesMap: Record<number, string> = body.notes_map;
    const noteInserts = (data ?? [])
      .map((lead, i) => notesMap[i] ? { lead_id: lead.id, author_id: user.id, body: notesMap[i] } : null)
      .filter(Boolean);
    if (noteInserts.length) {
      await admin.from("lead_notes").insert(noteInserts);
    }
  }

  // Batch-check AT&T fiber availability for leads that have coordinates.
  // This populates carrier_availability.att so green rings appear on the map.
  const leadsData = data ?? [];
  const coordPairs = leadsData
    .map((row, i) => ({ id: row.id, lat: inserts[i]?.lat, lng: inserts[i]?.lng }))
    .filter((r): r is { id: string; lat: number; lng: number } => r.lat != null && r.lng != null);

  if (coordPairs.length) {
    try {
      // Use batch spatial query (one DB round-trip regardless of lead count)
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

      // Only update the leads that have AT&T available (others stay as {} → false)
      const attIds = coordPairs.filter((_, i) => results[i] === true).map((r) => r.id);
      if (attIds.length) {
        await admin.from("leads").update({ carrier_availability: { att: true } }).in("id", attIds);
      }
    } catch {
      // Non-fatal: FCC check failure doesn't block import success
    }
  }

  return NextResponse.json({ imported: data?.length ?? 0, lead_ids: (data ?? []).map((r) => r.id) });
}
