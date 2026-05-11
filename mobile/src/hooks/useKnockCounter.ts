import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repApi } from '@/api/rep';
import { logsApi } from '@/api/logs';

/**
 * Derives today's knock count from /api/rep/knocks (returns last 30 days).
 * Provides a `log` mutation that posts a door_knock event and refetches the count.
 */
export function useKnockCounter(leadId?: string | null) {
  const qc = useQueryClient();

  const knocksQ = useQuery({
    queryKey: ['rep-knocks'],
    queryFn:  repApi.knocks,
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = knocksQ.data?.days?.find((d) => d.date === todayStr)?.knocks ?? 0;

  const log = useMutation({
    mutationFn: () => logsApi.create({
      event_type: 'door_knock',
      summary: 'Knocked',
      lead_id: leadId ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rep-knocks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
      if (leadId) qc.invalidateQueries({ queryKey: ['lead-logs', leadId] });
    },
  });

  return {
    today: todayCount,
    logKnock: () => log.mutate(),
    loggingKnock: log.isPending,
    isLoading: knocksQ.isLoading,
  };
}
