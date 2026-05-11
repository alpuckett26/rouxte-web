import { api } from './client';
import type { SalesGoal } from './goals';

export interface GoalWithAssigner extends SalesGoal {
  team_lead_bonus: number | null;
  assigned_by: string;
}

export const goalsManagerApi = {
  list:   () => api.get<{ data: GoalWithAssigner[] }>('/api/sales-goals'),
  create: (data: {
    user_id?: string | null;
    team_id?: string | null;
    period_type: 'weekly' | 'monthly';
    min_sales_count: number;
    min_revenue?: number;
    team_lead_bonus?: number;
    effective_from?: string;
    effective_to?: string;
  }) => api.post<{ data: GoalWithAssigner }>('/api/sales-goals', data),
};
