import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MigrateRow {
  address: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  status?: "new" | "attempted" | "contacted" | "qualified" | "appointment_set" | "sold" | "installed" | "closed_lost";
  assigned_to_user_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  follow_up_at?: string | null;
  appointment_at?: string | null;
  is_do_not_knock?: boolean;
  source_platform?: string;
  original_created_at?: string | null;
}

const GEOCODE_DELAY_MS = 250; // ~4 req/s — safe for Nominatim

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Rouxte/1.0 (field-sales-platform)" },
    });
    const data = await res.json();
    if (!data?.[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// POST /api/leads/migrate
// Accepts pre-mapped rows from the migration wizard, geocodes missing coordinates,
// and bulk-inserts into the leads table with notes.
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
  if (!["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Only admins and managers can run migrations" }, { status: 403 });
  }

  const body = await request.json();
  const rows: MigrateRow[] = body.rows ?? [];
  const sourcePlatform: string = body.source_platform ?? "csv";

  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  if (rows.length > 10000) return NextResponse.json({ error: "Max 10,000 rows per import" }, { status: 400 });

  let geocoded = 0;
  let failed = 0;
  const inserts: object[] = [];
  const notesMap: { idx: number; body: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.address?.trim()) { failed++; continue; }

    let lat = row.lat ?? null;
    let lng = row.lng ?? null;

    // Geocode if lat/lng missing or zero
    if (!lat || !lng) {
      const coords = await geocodeAddress(row.address);
      if (coords) { lat = coords.lat; lng = coords.lng; geocoded++; }
      else { failed++; continue; }
      await sleep(GEOCODE_DELAY_MS);
    }

    inserts.push({
      org_id:           profile.org_id,
      created_by:       user.id,
      address:          row.address.trim(),
      customer_name:    row.customer_name?.trim() || null,
      phone:            row.phone?.trim() || null,
      lat,
      lng,
      carrier_availability: {},
      status:           row.status ?? "new",
      assigned_to:      row.assigned_to_user_id ?? null,
      follow_up_at:     row.follow_up_at ?? null,
      appointment_at:   row.appointment_at ?? null,
      is_do_not_knock:  row.is_do_not_knock ?? false,
      source:           "import",
      created_at:       row.original_created_at ?? new Date().toISOString(),
    });

    if (row.notes?.trim()) {
      notesMap.push({ idx: inserts.length - 1, body: `[Imported from ${sourcePlatform}] ${row.notes.trim()}` });
    }
  }

  if (!inserts.length) {
    return NextResponse.json({ imported: 0, failed, geocoded, error: "No valid rows after processing" });
  }

  // Batch insert in chunks of 500
  const CHUNK = 500;
  let imported = 0;
  const insertedIds: { id: string }[] = [];

  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { data, error } = await admin.from("leads").insert(chunk).select("id");
    if (error) { failed += chunk.length; continue; }
    imported += data?.length ?? 0;
    insertedIds.push(...(data ?? []));
  }

  // Insert notes
  if (notesMap.length && insertedIds.length) {
    const noteInserts = notesMap
      .filter((n) => insertedIds[n.idx])
      .map((n) => ({
        lead_id:   insertedIds[n.idx].id,
        author_id: user.id,
        body:      n.body,
      }));
    if (noteInserts.length) {
      await admin.from("lead_notes").insert(noteInserts);
    }
  }

  return NextResponse.json({ imported, failed, geocoded, total: rows.length });
}
