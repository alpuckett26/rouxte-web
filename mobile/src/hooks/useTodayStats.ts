import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/api/logs';
import { useProfile } from '@/hooks/useProfile';
import type { SalesActivityLog, LogEventType } from '@/types';

export interface TodayStats {
  knocks: number;
  appts: number;
  sales: number;
  dnks: number;
  /** Most recent today's logs, newest first, capped at `recentLimit`. */
  recent: SalesActivityLog[];
  isLoading: boolean;
}

const APPT_EVENTS: LogEventType[] = ['appointment_set'];
const SALE_EVENTS: LogEventType[] = ['sale_submitted'];
const DNK_EVENTS:  LogEventType[] = ['do_not_knock_marked', 'no_solicit_observed'];
const KNOCK_EVENTS:LogEventType[] = ['door_knock'];

/**
 * Today's activity for the current user. Drives the Field-Mode stats bar
 * AND the "recent activity dots" overlay (rendered at each lead's coords).
 */
export function useTodayStats(recentLimit = 5): TodayStats {
  const { profile } = useProfile();
  const userId = profile?.user_id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const fromIso = startOfToday.toISOString();

  const q = useQuery({
    queryKey: ['logs', 'today', userId],
    enabled: !!userId,
    queryFn: () => logsApi.list({ user_id: userId, from: fromIso, page_size: 200 }),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  const all = q.data?.data ?? [];

  let knocks = 0, appts = 0, sales = 0, dnks = 0;
  for (const l of all) {
    if (KNOCK_EVENTS.includes(l.event_type)) knocks++;
    if (APPT_EVENTS.includes(l.event_type))  appts++;
    if (SALE_EVENTS.includes(l.event_type))  sales++;
    if (DNK_EVENTS.includes(l.event_type))   dnks++;
  }

  return {
    knocks, appts, sales, dnks,
    recent: all.slice(0, recentLimit),
    isLoading: q.isLoading,
  };
}
