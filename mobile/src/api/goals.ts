import { api } from './client';

export interface SalesGoal {
  id: string;
  org_id: string;
  user_id: string | null;
  team_id: string | null;
  period_type: 'weekly' | 'monthly';
  min_sales_count: number;
  min_revenue: number | null;
  effective_from: string;
  effective_to: string | null;
}

export interface GoalProgress {
  goal: SalesGoal;
  period: { start: string; end: string; label: string; days_left: number };
  progress: { count: number; revenue: number; goal_met: boolean };
  standing: 'active' | 'at_risk' | 'terminated';
}

export const goalsApi = {
  progress: () => api.get<{ data: GoalProgress | null; message?: string }>('/api/sales-goals/progress'),
};
