import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 90;

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

function nodeFilters(streetFilter: string | null): string {
  // Always require house number + street
  let f = '["addr:housenumber"]["addr:street"]';
  if (streetFilter) {
    // Case-insensitive substring match on street name
    const escaped = streetFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    f += `["addr:street"~"${escaped}",i]`;
  }
  return f;
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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const zip = request.nextUrl.searchParams.get("zip")?.trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Valid 5-digit zip code required" }, { status: 400 });
  }

  const streetFilter = request.nextUrl.searchParams.get("street")?.trim() || null;
  const numFrom = parseInt(request.nextUrl.searchParams.get("num_from") ?? "") || null;
  const numTo   = parseInt(request.nextUrl.searchParams.get("num_to") ?? "") || null;

  // Step 1: Resolve zip to US location via Nominatim
  let nominatimData: { osm_type: string; osm_id: number; boundingbox: string[] }[] = [];
  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=json&limit=1`,
      { headers: { "User-Agent": "Rouxte/1.0 (field-sales-app)" }, signal: AbortSignal.timeout(10000) }
    );
    if (nominatimRes.ok) nominatimData = await nominatimRes.json();
  } catch {
    // Fall through to Overpass-only approach if Nominatim fails
  }

  let elements: OverpassElement[] = [];
  let queryUsed = "";

  const nf = nodeFilters(streetFilter);

  if (nominatimData?.length) {
    const hit = nominatimData[0];

    if (hit.osm_type === "relation" && hit.osm_id) {
      const areaId = 3600000000 + Number(hit.osm_id);
      queryUsed = "relation";
      const result = await queryOverpass(`
[out:json][timeout:25][maxsize:10000000];
area(${areaId})->.z;
(node${nf}(area.z););
out 500;
      `.trim());

      if (!result.error) {
        elements = result.elements;
      } else {
        queryUsed = "bbox_fallback";
        const [south, north, west, east] = hit.boundingbox.map(Number);
        const bbox = await queryOverpass(`
[out:json][timeout:25][maxsize:10000000];
(node${nf}(${south},${west},${north},${east}););
out 500;
        `.trim());
        elements = bbox.elements;
      }
    } else {
      queryUsed = "bbox";
      const [south, north, west, east] = hit.boundingbox.map(Number);
      const result = await queryOverpass(`
[out:json][timeout:25][maxsize:10000000];
(node${nf}(${south},${west},${north},${east}););
out 500;
      `.trim());
      elements = result.elements;
    }
  } else {
    queryUsed = "postal_code_tag";
    const result = await queryOverpass(`
[out:json][timeout:25][maxsize:10000000];
(node${nf}["addr:postcode"="${zip}"](24,-125,50,-66););
out 500;
    `.trim());

    if (result.error === "rate_limit") {
      return NextResponse.json({ error: "OSM lookup is busy right now. Try again in a moment." }, { status: 429 });
    }
    elements = result.elements;

    if (!elements.length) {
      return NextResponse.json({ error: `Zip code ${zip} not found in the United States`, data: [], total: 0 });
    }
  }

  const addresses = elements
    .filter((el) => {
      if (!el.tags?.["addr:housenumber"] || !el.tags?.["addr:street"]) return false;
      if (numFrom !== null || numTo !== null) {
        const num = parseInt(el.tags["addr:housenumber"]);
        if (isNaN(num)) return false;
        if (numFrom !== null && num < numFrom) return false;
        if (numTo !== null && num > numTo) return false;
      }
      return true;
    })
    .map((el) => {
      const num = el.tags!["addr:housenumber"];
      const street = el.tags!["addr:street"];
      const city = el.tags?.["addr:city"] ?? "";
      const state = el.tags?.["addr:state"] ?? "";
      const address = [
        `${num} ${street}`,
        city,
        state ? `${state} ${zip}` : zip,
      ].filter(Boolean).join(", ");
      return { address, lat: el.lat ?? null, lng: el.lon ?? null };
    });

  const capped = elements.length >= 500;
  return NextResponse.json({ data: addresses, zip, total: addresses.length, capped, queryUsed });
}
