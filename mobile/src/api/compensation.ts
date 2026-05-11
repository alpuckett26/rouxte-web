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
  me: () => api.get<CompensationData>('/api/compensation/me'),
};
