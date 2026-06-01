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
  // viewer_is_admin is mirrored at the top level so the gate knows the
  // viewer's role even when `data` is null (org has no subscription row).
  status: () =>
    api.get<{ data: BillingStatus | null; viewer_is_admin?: boolean }>(
      '/api/billing/status',
    ),
};
