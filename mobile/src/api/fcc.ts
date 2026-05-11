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
};
