import { api } from './client';

export interface FunnelSubmission {
  id: string;
  customer_name: string | null;
  phone: string | null;
  lead_score: number | null;
  lead_temperature: 'hot' | 'warm' | 'cold' | null;
  recommended_pitch: string | null;
  service_interest: string | null;
  current_provider: string | null;
  switch_timeline: string | null;
  created_at: string;
}

export interface SmartPitchData {
  funnel: { id: string; slug: string; funnel_name: string } | null;
  stats: { total: number; hot: number; warm: number; cold: number } | null;
  recent: FunnelSubmission[];
  qr_data_url: string | null;
  funnel_url?: string;
}

export const smartpitchApi = {
  me:     () => api.get<SmartPitchData>('/api/rep/smartpitch'),
  create: () => api.post<{ funnel: { id: string; slug: string } }>('/api/rep/smartpitch'),
};
