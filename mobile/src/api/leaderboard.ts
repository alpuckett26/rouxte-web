import { api } from './client';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  team_name: string | null;
  sales: number;
  appointments: number;
  doors: number;
  training_pct: number;
  training_modules: number;
  goal: number | null;
  goal_pct: number | null;
  is_me: boolean;
}

export type Metric = 'sales' | 'appointments' | 'doors' | 'training';
export type Period = 'today' | 'week' | 'month' | 'alltime';

export const leaderboardApi = {
  list: (params: { period: Period; metric: Metric; team_id?: string }) =>
    api.get<{ data: LeaderboardEntry[]; period: Period; metric: Metric }>(
      '/api/leaderboard',
      { query: params as unknown as Record<string, string> },
    ),
};
