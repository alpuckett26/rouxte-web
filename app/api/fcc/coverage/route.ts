import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FCC_BASE = "https://broadbandmap.fcc.gov/api/public/map";

function isATT(brand: string): boolean {
  const b = brand.toLowerCase();
  return b.includes("at&t") || b.includes("att ") || b.includes("southwestern bell");
}

/**
 * GET /api/fcc/coverage?north=&south=&east=&west=
 *
 * When FCC_USERNAME + FCC_HASH_VALUE env vars are set:
 *   Queries the live FCC broadband map API across a grid of sample points
 *   and returns coordinates where AT&T fiber (tech 50) is confirmed available.
 *
 * Fallback (no credentials):
 *   Queries the local fcc_att_locations Supabase table.
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

  const fccUser = process.env.FCC_USERNAME;
  const fccHash = process.env.FCC_HASH_VALUE;

  // ── Live FCC API path ────────────────────────────────────────────────────────
  if (fccUser && fccHash) {
    const latSpan = north - south;
    const lngSpan = east - west;

    // Grid density: ~10×10 at street level — enough to show coverage pattern
    const rows = 10;
    const cols = 10;
    const points: { lat: number; lng: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        points.push({
          lat: south + (r + 0.5) * latSpan / rows,
          lng: west  + (c + 0.5) * lngSpan / cols,
        });
      }
    }

    const authHeaders: Record<string, string> = {
      "Accept": "application/json",
      "User-Agent": "Rouxte/1.0",
      "username": fccUser,
      "hash_value": fccHash,
    };

    // Batch 10 at a time — avoids overwhelming FCC rate limits
    const attPoints: { lat: number; lng: number }[] = [];
    let firstRawResponse: unknown = null;
    let firstError: string | null = null;

    for (let i = 0; i < points.length; i += 10) {
      const batch = points.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (pt) => {
          try {
            const url = new URL(`${FCC_BASE}/listAvailability`);
            url.searchParams.set("latitude",  pt.lat.toFixed(6));
            url.searchParams.set("longitude", pt.lng.toFixed(6));
            url.searchParams.set("unit",      "location");
            url.searchParams.set("category",  "all");
            url.searchParams.set("limit",     "25");
            url.searchParams.set("offset",    "0");

            const res = await fetch(url.toString(), { headers: authHeaders });
            const json = await res.json();

            // Capture first response for debugging
            if (firstRawResponse === null) firstRawResponse = { status: res.status, body: json };

            if (!res.ok) return null;
            const providers: { brand_name: string; technology: number }[] =
              json?.availability ?? json?.results ?? json?.data ?? [];

            const hasATTFiber = providers.some(
              (p) => isATT(p.brand_name) && p.technology === 50
            );
            return hasATTFiber ? pt : null;
          } catch (e) {
            if (!firstError) firstError = String(e);
            return null;
          }
        })
      );
      attPoints.push(...(results.filter(Boolean) as { lat: number; lng: number }[]));
    }

    const features = attPoints.map((pt) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pt.lng, pt.lat] },
      properties: {},
    }));

    return NextResponse.json(
      { type: "FeatureCollection", features, _debug: { pointsChecked: points.length, attFound: attPoints.length, firstResponse: firstRawResponse, firstError } },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Local DB fallback ────────────────────────────────────────────────────────
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fcc_att_coverage_bbox_distinct", {
    p_west: west, p_south: south, p_east: east, p_north: north,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const features = (data ?? []).map((row: { lat: number; lng: number }) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [row.lng, row.lat] },
    properties: {},
  }));

  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
