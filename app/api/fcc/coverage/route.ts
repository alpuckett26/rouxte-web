import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cellToBoundary, isValidCell } from "h3-js";

/**
 * GET /api/fcc/coverage?north=&south=&east=&west=
 *
 * Returns AT&T fiber coverage as GeoJSON polygons (H3 hex cells).
 * Each polygon covers the actual area where AT&T reports fiber service.
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

  const { data, error } = await admin.rpc("fcc_att_coverage_bbox", {
    p_west: west,
    p_south: south,
    p_east: east,
    p_north: north,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (data ?? []).map((row: { location_id: string; lat: number; lng: number }) => {
    // If location_id is a valid H3 cell, return the hex polygon
    if (isValidCell(row.location_id)) {
      const boundary = cellToBoundary(row.location_id);
      // cellToBoundary returns [lat, lng] pairs — GeoJSON needs [lng, lat]
      const coords = boundary.map(([lat, lng]) => [lng, lat]);
      coords.push(coords[0]); // close the ring
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: {},
      };
    }
    // Fallback: plain point if not an H3 ID (lat/lng format data)
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.lng, row.lat] },
      properties: {},
    };
  });

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
