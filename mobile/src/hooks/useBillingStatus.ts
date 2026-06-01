import { useQuery } from '@tanstack/react-query';
import { billingApi, type BillingStatus } from '@/api/billing';

/**
 * Reads /api/billing/status. Returns null inside data when the org has no
 * subscription row yet (which means "blocked — go subscribe via web").
 *
 * Web is the source of truth for trial signup because the Square Web
 * Payments SDK doesn't have a first-class React Native equivalent yet.
 * Mobile reads-only and routes the user back to the web /billing page
 * for changes.
 */
export function useBillingStatus() {
  const q = useQuery({
    queryKey: ['billing-status'],
    queryFn: billingApi.status,
    staleTime: 60_000,
  });

  const sub: BillingStatus | null | undefined = q.data?.data;
  // Prefer the top-level mirror (present even when sub is null); fall back to
  // the value inside the subscription row.
  const viewerIsAdmin = q.data?.viewer_is_admin ?? sub?.viewer_is_admin ?? false;

  return {
    isLoading: q.isLoading,
    error:     q.error,
    sub:       sub ?? null,
    /** Whether the current user can act on billing. Reps never can. */
    viewerIsAdmin,
    /** No subscription row at all OR explicitly canceled. App should block. */
    needsSignup: !q.isLoading && !sub,
    /** Subscription was suspended after 7 failed renewal attempts. App should block. */
    isSuspended: sub?.status === 'suspended' || sub?.status === 'canceled',
    refetch:   q.refetch,
  };
}
