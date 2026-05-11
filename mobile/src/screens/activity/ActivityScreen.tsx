import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { logsApi } from '@/api/logs';
import { Screen, Text, Card } from '@/components/ui';

export default function ActivityScreen() {
  const q = useQuery({ queryKey: ['logs', { page_size: 50 }], queryFn: () => logsApi.list({ page_size: 50 }) });

  const logs = q.data?.data ?? [];

  return (
    <Screen
      loading={q.isLoading}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>Activity</Text>
      {logs.map((row) => (
        <Card key={row.id} style={{ marginBottom: 8 }}>
          <Text variant="caption" tone="dim">{new Date(row.ts).toLocaleString()}</Text>
          <Text weight="medium">{row.event_type.replace(/_/g, ' ')}</Text>
          {row.summary && <Text tone="dim" style={{ marginTop: 4 }}>{row.summary}</Text>}
          {row.is_incident && <Text tone="warning" variant="caption" style={{ marginTop: 4 }}>⚠ Incident flagged</Text>}
        </Card>
      ))}
      {logs.length === 0 && !q.isLoading && (
        <Text tone="mute" style={{ textAlign: 'center', marginTop: 36 }}>No activity logged yet.</Text>
      )}
    </Screen>
  );
}
