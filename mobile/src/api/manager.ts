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

export interface TeamWithStats {
  id: string;
  name: string;
  tier: number;
  created_at: string;
  member_count: number;
  leads_count: number;
  sales_this_month: number;
}

export interface TeamMemberStats {
  user_id: string;
  full_name: string;
  role: OrgMember['role'];
  created_at: string;
  leads_count: number;
  sales_this_month: number;
}

export interface MyTeamResponse {
  team: { id: string; name: string; tier: number };
  members: TeamMemberStats[];
}

export interface FunnelStats {
  rep_id: string;
  full_name: string;
  slug: string;
  funnel_name: string;
  active: boolean;
  scan_count: number;
  total_submissions: number;
  hot_count: number;
  warm_count: number;
  cold_count: number;
  last_submission_at: string | null;
}

export const managerApi = {
  queue:       () => api.get<SalesQueueResponse>('/api/manager/sales-queue'),
  signoff:     (logId: string, action: 'sale_verified' | 'sale_rejected', note?: string) =>
    api.post<{ ok: true }>(`/api/manager/sales-queue/${logId}`, { action, note }),
  orgMembers:  () => api.get<{ data: OrgMember[] }>('/api/manager/org-members'),
  myTeam:      () => api.get<{ data: MyTeamResponse | null; message?: string }>('/api/manager/my-team'),
  teams:       () => api.get<{ data: TeamWithStats[] }>('/api/manager/teams'),
  createTeam:  (name: string) =>
    api.post<{ data: TeamWithStats }>('/api/manager/teams', { name }),
  funnels:     () => api.get<{ data: FunnelStats[] }>('/api/manager/funnels'),
};
