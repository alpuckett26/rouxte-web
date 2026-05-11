import { api } from './client';
import type { SalesActivityLog, LogEventType } from '@/types';

export interface LogsListParams {
  lead_id?: string;
  team_id?: string;
  user_id?: string;
  event_type?: LogEventType;
  incidents_only?: boolean;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface LogCreatePayload {
  event_type: LogEventType;
  summary: string;
  lead_id?: string | null;
  metadata?: Record<string, unknown>;
  amends_log_id?: string;
}

export const logsApi = {
  list:    (params?: LogsListParams) =>
    api.get<{ data: SalesActivityLog[]; total: number; page: number; page_size: number }>('/api/logs', { query: params as Record<string, string | number | boolean | undefined> | undefined }),
  create:  (payload: LogCreatePayload) => api.post<{ data: SalesActivityLog }>('/api/logs', payload as Record<string, unknown>),
  signoff: (id: string, action: 'acknowledged' | 'approved' | 'denied', note?: string) =>
    api.post<{ ok: true }>(`/api/logs/${id}/signoff`, { action, note }),
};
