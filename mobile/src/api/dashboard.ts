import { api } from './client';

export interface RepStats {
  user_id: string;
  full_name: string;
  doors_knocked: number;
  contacts: number;
  appointments: number;
  sales: number;
  conversion_pct: number;
}

export type TeamMemberStats = RepStats;

export interface DashboardResponse {
  rep_stats: RepStats;
  team_stats: TeamMemberStats[];
  pending_incidents: number;
}

export const dashboardApi = {
  get: () => api.get<DashboardResponse>('/api/dashboard'),
};
