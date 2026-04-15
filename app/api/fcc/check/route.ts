import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fcc/check?lat=30.123&lng=-97.456
 *
 * Returns whether AT&T fiber is available near the given coordinates.
 *
 * Strategy (in priority order):
 * 1. fcc_att_locations table (populated by scripts/import-fcc-bdc.ts) — exact
 * 2. BDC-imported leads (source='bdc_import') within ~2 km radius — fallback
 *    using the census tract centroid data the user imports via the BDC importer
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Try PostGIS fcc_att_available (exact address-level check)
  const { data: fccData, error: fccError } = await admin.rpc("fcc_att_available", { p_lat: lat, p_lng: lng });
  if (!fccError && fccData === true) {
    return NextResponse.json({ available: true, source: "fcc_bdc" });
  }

  // Skip BDC fallback if the fcc function errored (function missing → table not set up)
  // but always try BDC leads as secondary signal
  const DEG_2KM = 0.018; // ~2 km in degrees at mid-US latitudes
  const { data: bdcLeads } = await admin
    .from("leads")
    .select("id")
    .eq("source", "bdc_import")
    .gte("lat", lat - DEG_2KM)
    .lte("lat", lat + DEG_2KM)
    .gte("lng", lng - DEG_2KM * 1.3) // longitude degrees are shorter
    .lte("lng", lng + DEG_2KM * 1.3)
    .limit(1);

  if ((bdcLeads ?? []).length > 0) {
    return NextResponse.json({ available: true, source: "bdc_leads" });
  }

  // Neither source found coverage
  if (fccError && (fccError.message.includes("fcc_att_available") || fccError.message.includes("does not exist"))) {
    return NextResponse.json({ available: false, source: "fcc_unavailable" });
  }

  return NextResponse.json({ available: false, source: "fcc_bdc" });
}
