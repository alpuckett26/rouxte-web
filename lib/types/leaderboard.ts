// Shared types for leaderboard and bonus board — safe for client + server imports

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

export type Metric = "sales" | "appointments" | "doors" | "training";
export type Period = "today" | "week" | "month" | "alltime";

export interface BonusWinner {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  team_name: string | null;
  bonus: number;
  net_pay: number;
  sales_count: number;
  period_label: string;
  period_start: string;
  period_end: string;
  is_me: boolean;
}

export interface BonusPeriod {
  period_label: string;
  period_start: string;
  period_end: string;
  winners: BonusWinner[];
}
