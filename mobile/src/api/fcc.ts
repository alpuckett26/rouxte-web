import { api } from './client';

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const fccApi = {
  /** AT&T fiber census-block polygons covering the bbox. */
  blocks:   (bbox: BBox) => api.get<GeoJSON.FeatureCollection>('/api/fcc/blocks', { query: bbox as unknown as Record<string, number> }),
  /**
   * AT&T fiber coverage. Response is a FeatureCollection — feature geometry
   * type depends on zoom:
   *   zoom <  14 → Polygon (hex aggregation with properties.count)
   *   zoom >= 14 → Point   (individual served addresses)
   * Branch on geometry.type at the call site.
   */
  coverage: (bbox: BBox, zoom: number) => api.get<GeoJSON.FeatureCollection>('/api/fcc/coverage', {
    query: { ...bbox, zoom } as unknown as Record<string, number>,
  }),
  /** FCC availability check for a single lat/lng. */
  check:    (lat: number, lng: number) => api.get<{ att_available: boolean; source?: string }>('/api/fcc/check', { query: { lat, lng } }),
};
