import { api } from './client';

export interface MemberOnboarding {
  user_id: string;
  full_name: string;
  role: 'admin' | 'sales_manager' | 'team_lead' | 'sales_rep';
  onboarding_step: 'verify' | 'promo' | 'profile' | 'documents' | 'complete';
  onboarding_complete: boolean;
  team_id: string | null;
  docs_submitted: number;
  docs_required: number;
  created_at: string;
}

export const onboardingMonitorApi = {
  list: () => api.get<{ data: MemberOnboarding[] }>('/api/manager/onboarding'),
};
