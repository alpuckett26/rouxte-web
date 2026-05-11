import { api } from './client';

export type QuoteType = 'fiber' | 'wireless';

export interface QuoteLine {
  id?: string;
  quote_id?: string;
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

export interface Quote {
  id: string;
  org_id: string;
  rep_id: string;
  quote_type: QuoteType;
  customer_name: string | null;
  customer_email: string | null;
  monthly_total: number;
  fiber_plan: string | null;
  autopay_paperless: boolean | null;
  wireless_bundle: boolean | null;
  promo_note: string | null;
  total_lines: number | null;
  discount_type: string | null;
  activation_fee: number | null;
  created_at: string;
  quote_lines: QuoteLine[];
}

/** /api/quotes POST expects `lines` at the top level (NOT `quote_lines`). */
export interface QuoteCreateBody {
  quote_type: QuoteType;
  customer_name?: string | null;
  customer_email?: string | null;
  monthly_total?: number;
  fiber_plan?: string | null;
  autopay_paperless?: boolean | null;
  wireless_bundle?: boolean | null;
  promo_note?: string | null;
  total_lines?: number | null;
  discount_type?: string | null;
  activation_fee?: number | null;
  lines?: Omit<QuoteLine, 'id' | 'quote_id'>[];
}

export const quotesApi = {
  list:   () => api.get<{ quotes: Quote[] }>('/api/quotes'),
  get:    (id: string) => api.get<{ quote: Quote }>(`/api/quotes/${id}`),
  create: (data: QuoteCreateBody) => api.post<{ quote: Quote }>('/api/quotes', data as Record<string, unknown>),
  update: (id: string, data: Partial<QuoteCreateBody>) =>
    api.patch<{ quote: Quote }>(`/api/quotes/${id}`, data as Record<string, unknown>),
  delete: (id: string) => api.delete<{ ok: true }>(`/api/quotes/${id}`),
};
