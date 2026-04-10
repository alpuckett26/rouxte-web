import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

interface OverpassElement {
  type: string;
  lat?: number;         // present on nodes
  lon?: number;         // present on nodes
  center?: { lat: number; lon: number }; // present on ways (with "out center")
  tags?: Record<string, string>;
}

async function queryOverpass(query: string): Promise<{ elements: OverpassElement[]; error?: string }> {
  let res: Response;
  try {
    res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return { elements: [], error: "timeout" };
  }

  if (res.status === 429) return { elements: [], error: "rate_limit" };
  if (!res.ok) return { elements: [], error: `http_${res.status}` };

  const json = await res.json();
  if (json.error) return { elements: [], error: json.error };
  if (json.remark?.includes("timeout")) return { elements: [], error: "timeout" };

  return { elements: json.elements ?? [] };
}

async function reverseGeocodeZip(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "Rouxte/1.0 (field-sales-app)" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Extract 5-digit US zip from postcode (may be "77450-1234" format)
    return data.address?.postcode?.match(/^\d{5}/)?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/leads/bbox-addresses?south=X&north=X&west=X&east=X
 *
 * Returns OSM street addresses within a geographic bounding box.
 * Queries both address nodes AND building ways (with center coords)
 * since most US suburban homes store addresses on building polygons,
 * not as individual nodes.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const south = parseFloat(p.get("south") ?? "");
  const north = parseFloat(p.get("north") ?? "");
  const west  = parseFloat(p.get("west")  ?? "");
  const east  = parseFloat(p.get("east")  ?? "");

  if ([south, north, west, east].some(isNaN)) {
    return NextResponse.json({ error: "south, north, west, east are required" }, { status: 400 });
  }
  if (north <= south) {
    return NextResponse.json({ error: "north must be greater than south" }, { status: 400 });
  }
  if ((north - south) > 0.5 || (east - west) > 0.5) {
    return NextResponse.json({ error: "Selected area is too large. Draw a smaller box." }, { status: 400 });
  }

  // Query nodes AND ways with ANY housenumber — post-process to require street/place/full.
  // Dropping addr:street from the Overpass filter catches addr:place and addr:full patterns
  // used in some US address imports (common in Texas suburban areas).
  const result = await queryOverpass(`
[out:json][timeout:25][maxsize:10000000];
(
  node["addr:housenumber"](${south},${west},${north},${east});
  way["addr:housenumber"](${south},${west},${north},${east});
);
out center 1000;
  `.trim());

  if (result.error === "rate_limit") {
    return NextResponse.json({ error: "OSM is busy right now. Try again in a moment." }, { status: 429 });
  }
  if (result.error === "timeout") {
    return NextResponse.json({ error: "OSM lookup timed out. Try a smaller area." }, { status: 504 });
  }

  const rawCount = result.elements.length;

  const addresses = result.elements
    .filter((el) => {
      if (!el.tags?.["addr:housenumber"]) return false;
      // Accept addr:street, addr:place, or addr:full as the street identifier
      return !!(el.tags["addr:street"] || el.tags["addr:place"] || el.tags["addr:full"]);
    })
    .map((el) => {
      // Nodes have lat/lon directly; ways have a center object
      const lat = el.type === "node" ? (el.lat ?? null) : (el.center?.lat ?? null);
      const lng = el.type === "node" ? (el.lon ?? null) : (el.center?.lon ?? null);

      const num    = el.tags!["addr:housenumber"];
      const street = el.tags!["addr:street"] ?? el.tags!["addr:place"] ?? "";
      const city   = el.tags?.["addr:city"]     ?? "";
      const state  = el.tags?.["addr:state"]    ?? "";
      const zip    = el.tags?.["addr:postcode"] ?? "";

      // If we only have addr:full (complete address string), use it directly
      if (!street && el.tags?.["addr:full"]) {
        return { address: el.tags["addr:full"], lat, lng };
      }

      const address = [
        `${num} ${street}`,
        city,
        [state, zip].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");

      return { address, lat, lng };
    })
    .filter((a) => a.lat != null && a.lng != null);

  // OSM has no usable address data here — detect ZIP to guide user to ZIP import fallback
  if (!addresses.length) {
    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;
    const detectedZip = await reverseGeocodeZip(centerLat, centerLon);

    return NextResponse.json(
      {
        error: "No address data found in this area. OSM coverage may be incomplete here — try the ZIP import instead.",
        data: [],
        total: 0,
        detectedZip,
        _debug: { rawElements: rawCount, bbox: { south, north, west, east } },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: addresses, total: addresses.length, capped: rawCount >= 1000 });
}
