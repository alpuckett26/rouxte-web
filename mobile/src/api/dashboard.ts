import { api } from './client';

export interface DashboardResponse {
  today: {
    knocks: number;
    contacts: number;
    appointments: number;
    sales: number;
  };
  recent_activity: Array<{
    id: string;
    event_type: string;
    created_at: string;
    lead_id: string | null;
    notes: string | null;
  }>;
  knock_history: Array<{ date: string; count: number }>;
}

export const dashboardApi = {
  get: () => api.get<DashboardResponse>('/api/dashboard'),
};
