import { api } from './client';

export interface BillingStatus {
  org_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended';
  tier_key: string;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_end: string | null;
  days_left: number;
  is_in_trial: boolean;
  has_active_access: boolean;
  needs_payment: boolean;
  viewer_is_admin: boolean;
  square_card_id: string | null;
  billing_email: string | null;
  billing_name: string | null;
}

export const billingApi = {
  status: () => api.get<{ data: BillingStatus | null }>('/api/billing/status'),
};
