import { api } from './client';

export interface SaleEntry {
  id: string;
  created_at: string;
  lead_address: string | null;
  customer_name: string | null;
  metadata: Record<string, unknown>;
  status: 'pending' | 'verified' | 'rejected';
  signoff_note: string | null;
}

export interface ActivityEntry {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

export interface RepSalesResponse {
  sales: SaleEntry[];
  activity: ActivityEntry[];
}

export interface KnockDay {
  date: string;
  knocks: number;
  sales: number;
}

export interface RepKnocksResponse {
  days: KnockDay[];
}

export const repApi = {
  sales:  () => api.get<RepSalesResponse>('/api/rep/sales'),
  knocks: () => api.get<RepKnocksResponse>('/api/rep/knocks'),
};
