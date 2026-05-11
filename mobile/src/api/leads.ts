import { api } from './client';
import type { Lead, LeadStatus, LeadNote, Tag } from '@/types';

export interface LeadsListParams {
  status?: LeadStatus;
  assigned_to?: string;
  carrier?: 'att';
  tags?: string;
  is_do_not_knock?: boolean;
  page?: number;
  page_size?: number;
}

export const leadsApi = {
  list:    (params: LeadsListParams = {}) =>
    api.get<{ data: Lead[]; total: number; page: number; page_size: number }>('/api/leads', {
      query: params as Record<string, string | number | boolean | undefined>,
    }),
  get:     (id: string) => api.get<{ data: Lead }>(`/api/leads/${id}`),
  create:  (data: Partial<Lead>) => api.post<{ data: Lead }>('/api/leads', data as Record<string, unknown>),
  update:  (id: string, data: Partial<Lead>) => api.patch<{ data: Lead }>(`/api/leads/${id}`, data as Record<string, unknown>),
  delete:  (id: string) => api.delete<{ ok: true }>(`/api/leads/${id}`),
  notes:    (id: string) => api.get<{ data: LeadNote[] }>(`/api/leads/${id}/note`),
  addNote:  (id: string, body: string) => api.post<{ data: LeadNote }>(`/api/leads/${id}/note`, { body }),
  leadTags: (id: string) => api.get<{ data: Array<{ id: string; tag: Tag }> }>(`/api/leads/${id}/tags`),
  assign:  (id: string, user_id: string | null) => api.post<{ ok: true }>(`/api/leads/${id}/assign`, { user_id }),
  markDnk: (id: string) => api.post<{ ok: true }>(`/api/leads/${id}/dnk`),
  tag:     (id: string, tag_id: string) => api.post<{ ok: true }>(`/api/leads/${id}/tags`, { tag_id }),
  untag:   (id: string, tagId: string) => api.delete<{ ok: true }>(`/api/leads/${id}/tags/${tagId}`),
  pull:    () => api.post<{ data: Lead | null }>('/api/manager/leads/pull'),
  bulkAssign: (lead_ids: string[], user_id: string | null) =>
    api.post<{ count: number }>('/api/leads/bulk-assign', { lead_ids, user_id }),
  tags:    () => api.get<{ data: Tag[] }>('/api/tags'),
};
