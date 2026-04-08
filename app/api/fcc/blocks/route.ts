import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/fcc/blocks?north=&south=&east=&west=
 *
 * Returns AT&T fiber coverage as GeoJSON Polygon features at the census block level.
 * Populated by scripts/import-fcc-blocks.ts from FCC BDC + Census TIGERweb.
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
  const { data, error } = await admin.rpc("fcc_att_blocks_bbox", {
    p_west: west, p_south: south, p_east: east, p_north: north,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // PostgREST returns geometry columns as GeoJSON objects
  const features = (data ?? []).map((row: { block_geoid: string; geom: unknown }) => ({
    type: "Feature",
    geometry: row.geom,
    properties: { block_geoid: row.block_geoid },
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
