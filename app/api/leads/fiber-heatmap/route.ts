import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leads/fiber-heatmap?north=X&south=X&east=X&west=X
 *
 * Returns BDC-imported leads as a GeoJSON FeatureCollection for use with a
 * Mapbox heatmap layer. Only returns leads with source='bdc_import' whose
 * coordinates fall within the supplied bounding box.
 *
 * Query params (all required):
 *   north, south, east, west — bounding box coordinates (floats)
 *
 * Response: GeoJSON FeatureCollection (Point features, no properties)
 * Cache-Control: public, max-age=3600
 */
export async function GET(request: NextRequest) {
  // Auth check — must be logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse bounding box params
  const p = request.nextUrl.searchParams;
  const north = parseFloat(p.get("north") ?? "");
  const south = parseFloat(p.get("south") ?? "");
  const east = parseFloat(p.get("east") ?? "");
  const west = parseFloat(p.get("west") ?? "");

  if ([north, south, east, west].some(isNaN)) {
    return NextResponse.json(
      { error: "north, south, east, and west query params are required and must be valid numbers" },
      { status: 400 },
    );
  }

  if (north <= south) {
    return NextResponse.json(
      { error: "north must be greater than south" },
      { status: 400 },
    );
  }

  // Query BDC-imported leads within the bbox using the admin client (bypasses RLS)
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select("lat, lng")
    .eq("source", "bdc_import")
    .gte("lat", south)
    .lte("lat", north)
    .gte("lng", west)
    .lte("lng", east)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .limit(50_000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const geojson = {
    type: "FeatureCollection",
    features: (data ?? []).map((row) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [row.lng, row.lat],
      },
      properties: {},
    })),
  };

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
