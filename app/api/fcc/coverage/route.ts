import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fcc/coverage?north=&south=&east=&west=
 *
 * Returns AT&T fiber locations within the given bounding box as GeoJSON.
 * Used by the map heatmap/coverage layer.
 * Capped at 8000 points — at low zoom the heatmap blends them anyway.
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

  // ST_MakeEnvelope(minX, minY, maxX, maxY, srid)
  const { data, error } = await admin.rpc("fcc_att_coverage_bbox", {
    p_west: west,
    p_south: south,
    p_east: east,
    p_north: north,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (data ?? []).map((row: { lat: number; lng: number }) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [row.lng, row.lat] },
    properties: {},
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
