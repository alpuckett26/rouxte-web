import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';

/** Polls /api/notifications every 60s — exposes unread count + recent list. */
export function useNotifications() {
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn:  notificationsApi.list,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  return {
    notifications: q.data?.notifications ?? [],
    unread:        q.data?.unread ?? 0,
    isLoading:     q.isLoading,
    refetch:       q.refetch,
  };
}
