import { api } from './client';

export interface SalesTier {
  id: string;
  name: string;
  commission_pct: number;
}

export interface CompensationData {
  tier: SalesTier | null;
  standing: 'active' | 'at_risk' | 'terminated';
}

export const compensationApi = {
  me:          () => api.get<CompensationData>('/api/compensation/me'),
  tiers:       () => api.get<{ data: SalesTierRow[] }>('/api/sales-tiers'),
  updateTiers: (tiers: Array<{ id: string; commission_pct: number; name?: string }>) =>
    api.patch<{ data: SalesTierRow[] }>('/api/sales-tiers', { tiers }),
};

export interface SalesTierRow {
  id: string;
  org_id: string;
  name: string;
  commission_pct: number;
  display_order: number;
  created_at: string;
}
