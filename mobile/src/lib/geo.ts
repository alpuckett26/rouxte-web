// Lat/lng geo math — pure utilities. No platform deps so this file is shared
// between Field Mode features (nearest-unworked-lead pointer, breadcrumb
// distance throttling, etc.).

const R_METERS = 6371_000; // mean earth radius

function toRad(deg: number): number { return (deg * Math.PI) / 180; }
function toDeg(rad: number): number { return (rad * 180) / Math.PI; }

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_METERS * Math.asin(Math.sqrt(x));
}

/** Initial compass bearing from a → b, in degrees (0 = north, clockwise). */
export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassLabel = typeof COMPASS_8[number];

/** 8-point compass label for the given bearing (degrees). */
export function compassLabel(bearing: number): CompassLabel {
  const i = Math.round(((bearing % 360) / 45)) % 8;
  return COMPASS_8[i];
}

/** Format a meter distance the way a rep would read it. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    // Sub-km — use feet, rounded to the nearest 5 for legibility
    const ft = meters * 3.28084;
    const rounded = Math.round(ft / 5) * 5;
    return `${rounded} ft`;
  }
  const miles = meters / 1609.344;
  return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
}
