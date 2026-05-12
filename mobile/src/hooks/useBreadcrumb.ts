import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineMeters } from '@/lib/geo';

interface Sample {
  /** [lng, lat] tuple — matches GeoJSON order */
  c: [number, number];
  /** epoch ms */
  t: number;
}

const MIN_SAMPLE_INTERVAL_MS = 30_000;     // sample at most every 30s
const MIN_MOVE_METERS        = 8;          // skip if we haven't moved
const MAX_SAMPLES            = 500;        // cap buffer length
const RETENTION_MS           = 6 * 3600_000; // 6h trailing window

function dateKey(d = new Date()): string {
  return `map.breadcrumb.${d.toISOString().slice(0, 10)}`;
}

/**
 * Local breadcrumb trail for the rep walking a route. Samples GPS coords
 * (passed in from MapScreen's `<UserPuck onUpdate>`) at most every 30s,
 * skips when the rep hasn't moved >= 8m, persists today's buffer to
 * AsyncStorage under map.breadcrumb.{YYYY-MM-DD}, keeps the last 6h.
 *
 * Cleared automatically when the date key rolls — yesterday's trail
 * disappears from the map without us needing to garbage-collect it.
 *
 * Returns a GeoJSON FeatureCollection with a single LineString feature
 * ready to drop into a Mapbox.ShapeSource. Empty if fewer than 2 points.
 */
export function useBreadcrumb(coord: [number, number] | null) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const lastSampleRef = useRef<Sample | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load today's existing buffer on mount
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(dateKey()).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as Sample[];
        if (Array.isArray(parsed)) {
          // Drop anything older than retention window
          const cutoff = Date.now() - RETENTION_MS;
          const fresh = parsed.filter((s) => s.t >= cutoff);
          setSamples(fresh);
          lastSampleRef.current = fresh[fresh.length - 1] ?? null;
        }
      } catch { /* corrupt — start fresh */ }
    });
    return () => { cancelled = true; };
  }, []);

  // Sample on coord changes, with throttle + distance gate
  useEffect(() => {
    if (!coord) return;
    const now = Date.now();
    const last = lastSampleRef.current;

    if (last) {
      if (now - last.t < MIN_SAMPLE_INTERVAL_MS) return;
      const moved = haversineMeters(
        { lng: last.c[0], lat: last.c[1] },
        { lng: coord[0], lat: coord[1] },
      );
      if (moved < MIN_MOVE_METERS) return;
    }

    const next: Sample = { c: [coord[0], coord[1]], t: now };
    lastSampleRef.current = next;

    setSamples((prev) => {
      const cutoff = now - RETENTION_MS;
      const trimmed = [...prev.filter((s) => s.t >= cutoff), next];
      const sized = trimmed.length > MAX_SAMPLES ? trimmed.slice(-MAX_SAMPLES) : trimmed;

      // Debounce the AsyncStorage write — don't hammer it on every sample
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      writeTimerRef.current = setTimeout(() => {
        AsyncStorage.setItem(dateKey(), JSON.stringify(sized)).catch(() => {});
      }, 2000);

      return sized;
    });
  }, [coord]);

  // Build the GeoJSON the layer renders
  if (samples.length < 2) {
    return { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
  }
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: samples.map((s) => s.c) },
    }],
  } as GeoJSON.FeatureCollection;
}
