import { api } from './client';
import { offlineQueue } from '@/lib/offlineQueue';
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

  /**
   * When offline, queues the log to AsyncStorage and returns a synthetic
   * success so the calling mutation's onSuccess still fires (counters
   * invalidate, sheets close). The real POST runs on NetInfo reconnect.
   *
   * Door knocks are the 80% offline-write case — a rep walking a route
   * with patchy coverage can't lose their work.
   */
  create:  async (payload: LogCreatePayload) => {
    if (offlineQueue.isOnline()) {
      return api.post<{ data: SalesActivityLog }>('/api/logs', payload as Record<string, unknown>);
    }
    await offlineQueue.enqueue({
      method: 'POST',
      path:   '/api/logs',
      body:   payload,
    });
    const synthetic: SalesActivityLog = {
      id:            `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      org_id:        '',
      lead_id:       payload.lead_id ?? null,
      actor_id:      '',
      team_id:       null,
      event_type:    payload.event_type,
      summary:       payload.summary,
      metadata:      payload.metadata ?? {},
      amends_log_id: payload.amends_log_id ?? null,
      is_incident:   false,
      ts:            new Date().toISOString(),
    };
    return { data: synthetic };
  },

  signoff: (id: string, action: 'acknowledged' | 'approved' | 'denied', note?: string) =>
    api.post<{ ok: true }>(`/api/logs/${id}/signoff`, { action, note }),
};
