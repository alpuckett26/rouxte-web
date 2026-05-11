import { api } from './client';

export interface CoachQA {
  id: string;
  org_id: string;
  trigger: string;
  response: string;
  category: 'objection' | 'pitch' | 'closing' | 'followup' | 'rebuttal' | 'opening';
  use_count: number;
  active: boolean;
  created_at: string;
}

export interface CompetitorIntel {
  id: string;
  org_id: string | null;
  competitor: string;
  plan_name: string;
  monthly_price: number;
  download_mbps: number | null;
  upload_mbps: number | null;
  contract_required: boolean;
  data_cap_gb: number | null;
  notes: string | null;
  active: boolean;
}

export const coachApi = {
  qaList:      () => api.get<{ data: CoachQA[] }>('/api/coach/qa'),
  qaCreate:    (data: { trigger: string; response: string; category?: CoachQA['category'] }) =>
    api.post<{ data: CoachQA }>('/api/coach/qa', data),
  qaDelete:    (id: string) => api.delete<{ ok: true }>(`/api/coach/qa/${id}`),
  competitors: () => api.get<{ data: CompetitorIntel[] }>('/api/coach/competitors'),
};
