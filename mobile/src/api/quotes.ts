import { api } from './client';

export type QuoteType = 'fiber' | 'wireless';

export interface QuoteSummary {
  id: string;
  quote_type: QuoteType;
  customer_name: string | null;
  customer_email: string | null;
  monthly_total: number;
  created_at: string;
}

export interface Quote extends QuoteSummary {
  org_id: string;
  rep_id: string;
  fiber_plan: string | null;
  autopay_paperless: boolean | null;
  wireless_bundle: boolean | null;
  promo_note: string | null;
  total_lines: number | null;
  discount_type: string | null;
  activation_fee: number | null;
  quote_lines: QuoteLine[];
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  line_number: number;
  plan_type: string;
  rate_plan: number;
  plan_promo: number;
  next_up: boolean;
  next_up_amt: number;
  insurance: number;
  retailer_promo: number;
  device: number;
  device_promo: number;
  line_total: number;
}

export const quotesApi = {
  list:   () => api.get<{ quotes: QuoteSummary[] }>('/api/quotes'),
  get:    (id: string) => api.get<Quote>(`/api/quotes/${id}`),
  create: (data: Partial<Quote>) => api.post<Quote>('/api/quotes', data as Record<string, unknown>),
  update: (id: string, data: Partial<Quote>) => api.patch<Quote>(`/api/quotes/${id}`, data as Record<string, unknown>),
  delete: (id: string) => api.delete<{ ok: true }>(`/api/quotes/${id}`),
};
