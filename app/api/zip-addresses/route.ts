import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const zip = request.nextUrl.searchParams.get("zip")?.trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Valid 5-digit zip code required" }, { status: 400 });
  }

  // Step 1: Resolve zip to US bounding box via Nominatim
  const nominatimRes = await fetch(
    `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=json&limit=1`,
    { headers: { "User-Agent": "Rouxte/1.0 (field-sales-app)" }, signal: AbortSignal.timeout(10000) }
  );

  if (!nominatimRes.ok) {
    return NextResponse.json({ error: "Address lookup service unavailable" }, { status: 502 });
  }

  const nominatimData = await nominatimRes.json();
  if (!nominatimData?.length) {
    return NextResponse.json({ error: `Zip code ${zip} not found in the United States`, data: [], total: 0 });
  }

  const [south, north, west, east] = nominatimData[0].boundingbox.map(Number);

  // Step 2: Query Overpass within the US bbox for this zip
  const query = `
[out:json][timeout:30];
(
  node["addr:housenumber"]["addr:street"](${south},${west},${north},${east});
);
out body;
  `.trim();

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(35000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Address lookup service unavailable" }, { status: 502 });
  }

  const json = await res.json();
  const elements: OverpassElement[] = json.elements ?? [];

  const addresses = elements
    .filter((el) => el.tags?.["addr:housenumber"] && el.tags?.["addr:street"])
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

      return {
        address,
        lat: el.lat ?? null,
        lng: el.lon ?? null,
      };
    });

  return NextResponse.json({ data: addresses, zip, total: addresses.length });
}
