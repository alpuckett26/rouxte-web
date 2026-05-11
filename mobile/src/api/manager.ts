import { api } from './client';

export interface PendingSale {
  id: string;
  user_id: string;
  full_name: string;
  lead_id: string | null;
  lead_address: string | null;
  customer_name: string | null;
  metadata: Record<string, unknown>;
  summary: string;
  created_at: string;
}

export interface VerifiedSale extends PendingSale {
  signoff_action: 'sale_verified' | 'sale_rejected';
  signoff_note: string | null;
  signoff_at: string;
}

export interface SalesQueueResponse {
  pending: PendingSale[];
  verified: VerifiedSale[];
  rejected: VerifiedSale[];
}

export interface OrgMember {
  user_id: string;
  full_name: string;
  role: 'admin' | 'sales_manager' | 'team_lead' | 'sales_rep';
}

export const managerApi = {
  queue:       () => api.get<SalesQueueResponse>('/api/manager/sales-queue'),
  signoff:     (logId: string, action: 'sale_verified' | 'sale_rejected', note?: string) =>
    api.post<{ ok: true }>(`/api/manager/sales-queue/${logId}`, { action, note }),
  orgMembers:  () => api.get<{ data: OrgMember[] }>('/api/manager/org-members'),
  myTeam:      () => api.get<{ data: OrgMember[] }>('/api/manager/my-team'),
  teams:       () => api.get<{ data: Array<{ id: string; name: string; member_count: number }> }>('/api/manager/teams'),
};
