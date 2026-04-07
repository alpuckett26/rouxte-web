import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { latLngToCell, cellToBoundary } from "h3-js";

/**
 * GET /api/fcc/coverage?north=&south=&east=&west=
 *
 * Returns AT&T fiber coverage as GeoJSON polygons (H3 res8 hex cells).
 * The DB stores H3 cell centroids; we reconstruct the full hex boundary
 * so the map renders actual coverage areas, not misleading grid dots.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const north = parseFloat(searchParams.get("north") ?? "");
  const south = parseFloat(searchParams.get("south") ?? "");
  const east  = parseFloat(searchParams.get("east")  ?? "");
  const west  = parseFloat(searchParams.get("west")  ?? "");

  if ([north, south, east, west].some(isNaN)) {
    return NextResponse.json({ error: "north, south, east, west required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Distinct centroids — each unique lat/lng = one H3 res8 cell
  const { data, error } = await admin.rpc("fcc_att_coverage_bbox_distinct", {
    p_west: west, p_south: south, p_east: east, p_north: north,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (data ?? []).map((row: { lat: number; lng: number }) => {
    const h3Index = latLngToCell(row.lat, row.lng, 8);
    const boundary = cellToBoundary(h3Index); // [[lat,lng], ...]
    const coords = boundary.map(([lat, lng]) => [lng, lat]); // → [lng,lat] for GeoJSON
    coords.push(coords[0]); // close the ring
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {},
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
