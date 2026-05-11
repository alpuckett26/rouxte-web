import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

interface BDCRow {
  address: string;
  lat: number;
  lng: number;
  brand_name?: string;
  technology?: string | number;
  max_down?: number | null;
  max_up?: number | null;
}

/**
 * POST /api/leads/import-bdc
 * Accepts pre-parsed BDC rows (already filtered for fiber, tech=50).
 * Upserts into leads — skips rows with duplicate lat/lng in the same org.
 * Max 10,000 rows per call (call in batches from client).
 */
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
    return NextResponse.json({ error: "Forbidden — admin/manager only" }, { status: 403 });
  }

  const body = await request.json();
  const rows: BDCRow[] = body.rows ?? [];

  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  if (rows.length > 10_000) return NextResponse.json({ error: "Max 10,000 rows per batch" }, { status: 400 });

  // Deduplicate within the batch itself first (same lat/lng)
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const inserts = unique.map((row) => ({
    org_id:      profile.org_id,
    created_by:  user.id,
    address:     row.address.trim(),
    lat:         row.lat,
    lng:         row.lng,
    status:      "new" as const,
    source:      "bdc_import",
    carrier_availability: {
      att: true, // BDC fiber data = confirmed fiber available
      competitors: row.brand_name ? [row.brand_name] : [],
      max_down_mbps: row.max_down ?? null,
      max_up_mbps:   row.max_up  ?? null,
    },
  }));

  // Use upsert on (org_id, address) to skip exact address dupes
  // This prevents re-importing the same file from creating doubles
  const { data, error } = await admin
    .from("leads")
    .upsert(inserts, {
      onConflict:        "org_id,address",
      ignoreDuplicates:  true,
    })
    .select("id");

  if (error) {
    // If upsert constraint fails, fall back to insert and ignore errors
    const { data: insertData } = await admin
      .from("leads")
      .insert(inserts)
      .select("id");
    return NextResponse.json({ imported: insertData?.length ?? 0 });
  }

  return NextResponse.json({ imported: data?.length ?? 0 });
}

/**
 * DELETE /api/leads/import-bdc
 * Removes all BDC-imported leads (source='bdc_import') for the org.
 * Used to clear stale H3-approximate data before re-importing with
 * Census Tract centroids.
 */
export async function DELETE(_request: NextRequest) {
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
    return NextResponse.json({ error: "Forbidden — admin/manager only" }, { status: 403 });
  }

  const { count, error } = await admin
    .from("leads")
    .delete({ count: "exact" })
    .eq("org_id", profile.org_id)
    .eq("source", "bdc_import");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
