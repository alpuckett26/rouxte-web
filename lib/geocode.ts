// Server-only forward geocoding via Mapbox. Used by the lead import route and
// the Answers sync cron so address-only leads land on the map.

const MAPBOX_GEOCODE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Forward-geocode a single address. Returns null on no-match or any error —
 * callers treat geocoding as best-effort (a lead without coords is still valid,
 * it just won't render on the map until coords exist).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_GEOCODE_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `${MAPBOX_GEOCODE_URL}/${encodeURIComponent(address)}.json` +
        `?limit=1&country=us&types=address,poi&access_token=${token}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const center: [number, number] | undefined = data?.features?.[0]?.center;
    if (!center) return null;
    const [lng, lat] = center;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocode many addresses with bounded concurrency and a hard cap, so a large
 * import can't exhaust Mapbox rate limits or hold the request open too long.
 * Returns a Map keyed by the input index; missing keys = not geocoded.
 */
export async function geocodeBatch(
  addresses: { index: number; address: string }[],
  { cap = 200, concurrency = 5 }: { cap?: number; concurrency?: number } = {},
): Promise<Map<number, GeocodeResult>> {
  const results = new Map<number, GeocodeResult>();
  const queue = addresses.slice(0, cap);

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const coords = await geocodeAddress(item.address);
      if (coords) results.set(item.index, coords);
    }
  });

  await Promise.all(workers);
  return results;
}
