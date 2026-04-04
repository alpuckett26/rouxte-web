import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fcc/check?lat=30.123&lng=-97.456
 *
 * Returns whether AT&T fiber is available within 100m of the given coordinates
 * based on FCC BDC data imported into fcc_att_locations.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Use PostGIS ST_DWithin to find any AT&T fiber location within 100 metres
  const { data, error } = await admin.rpc("fcc_att_available", { p_lat: lat, p_lng: lng });

  if (error) {
    // If the function doesn't exist yet (migration not run), fall back gracefully
    if (error.message.includes("fcc_att_available") || error.message.includes("does not exist")) {
      return NextResponse.json({ available: null, source: "fcc_unavailable" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: data === true, source: "fcc_bdc" });
}
