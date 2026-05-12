import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fcc/coverage?north=&south=&east=&west=&zoom=
 *
 * Returns AT&T fiber coverage from fcc_att_locations.
 *
 * Behavior depends on zoom:
 *   - zoom >= 14 (or missing) → individual point features (capped at 50k)
 *   - zoom <  14              → hex polygon aggregation, each feature has
 *                               properties.count = locations served in the cell
 *
 * Mobile clients pass zoom and pick a renderer based on geometry.type.
 * The legacy web map (app/components/map/MapboxMap.tsx) gates its fetch to
 * zoom >= 13 and never passes zoom — gets the points path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const north = parseFloat(searchParams.get("north") ?? "");
  const south = parseFloat(searchParams.get("south") ?? "");
  const east  = parseFloat(searchParams.get("east")  ?? "");
  const west  = parseFloat(searchParams.get("west")  ?? "");
  const zoomRaw = searchParams.get("zoom");
  const zoom  = zoomRaw ? parseFloat(zoomRaw) : Infinity;

  if ([north, south, east, west].some(isNaN)) {
    return NextResponse.json({ error: "north, south, east, west required" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (zoom < 14) {
    // Hex aggregation. Pick a size that gives ~30–60 hexes across the viewport.
    const hexSize = hexSizeForZoom(zoom);
    const { data, error } = await admin.rpc("fcc_att_coverage_hex", {
      p_west: west, p_south: south, p_east: east, p_north: north, p_hex_size: hexSize,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const features = (data ?? []).map((row: { geojson: string; location_count: number }) => ({
      type: "Feature" as const,
      geometry: JSON.parse(row.geojson),
      properties: { count: Number(row.location_count) },
    }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  }

  // Points path (zoom >= 14 or missing zoom)
  const { data, error } = await admin.rpc("fcc_att_coverage_bbox_distinct", {
    p_west: west, p_south: south, p_east: east, p_north: north,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (data ?? []).map((row: { lat: number; lng: number }) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [row.lng, row.lat] },
    properties: {},
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}

// Hex perpendicular distance in degrees, scaled by zoom.
// Mobile-friendly: ~30–60 hexes across a typical viewport.
function hexSizeForZoom(zoom: number): number {
  if (zoom <= 10) return 0.008;
  if (zoom <= 11) return 0.005;
  if (zoom <= 12) return 0.003;
  if (zoom <= 13) return 0.0018;
  return 0.001;
}
