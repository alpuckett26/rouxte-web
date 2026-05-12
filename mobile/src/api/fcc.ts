import { api } from './client';

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const fccApi = {
  /** AT&T fiber census-block polygons covering the bbox. */
  blocks:   (bbox: BBox) => api.get<GeoJSON.FeatureCollection>('/api/fcc/blocks',   { query: bbox as unknown as Record<string, number> }),
  /** AT&T fiber address-level points covering the bbox. */
  coverage: (bbox: BBox) => api.get<GeoJSON.FeatureCollection>('/api/fcc/coverage', { query: bbox as unknown as Record<string, number> }),
  /** FCC availability check for a single lat/lng. */
  check:    (lat: number, lng: number) => api.get<{ att_available: boolean; tech_codes?: string[]; max_down_mbps?: number; max_up_mbps?: number }>('/api/fcc/check', { query: { lat, lng } }),
};
