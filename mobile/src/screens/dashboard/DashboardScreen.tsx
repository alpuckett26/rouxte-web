import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { logsApi } from '@/api/logs';
import { useProfile, isManager } from '@/hooks/useProfile';
import { Screen, Text, Card } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function DashboardScreen() {
  const { profile } = useProfile();
  const showTeam = isManager(profile?.role);

  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const logsQ = useQuery({
    queryKey: ['logs', { page_size: 8 }],
    queryFn:  () => logsApi.list({ page_size: 8 }),
  });

  const me = dashQ.data?.rep_stats;
  const team = dashQ.data?.team_stats ?? [];
  const incidents = dashQ.data?.pending_incidents ?? 0;
  const recent = logsQ.data?.data ?? [];

  return (
    <Screen
      loading={dashQ.isLoading}
      refreshing={dashQ.isFetching && !dashQ.isLoading}
      onRefresh={() => { dashQ.refetch(); logsQ.refetch(); }}
    >
      <Text variant="caption" tone="dim" style={styles.greeting}>WELCOME BACK</Text>
      <Text variant="title" weight="bold" style={styles.name}>
        {profile?.full_name ?? 'Friend'}
      </Text>

      <View style={styles.grid}>
        <Stat label="Knocks"        value={me?.doors_knocked ?? 0} />
        <Stat label="Contacts"      value={me?.contacts ?? 0}      />
        <Stat label="Appointments"  value={me?.appointments ?? 0}  />
        <Stat label="Sales"         value={me?.sales ?? 0} tone="brand" />
      </View>

      {me && me.doors_knocked > 0 && (
        <Card style={{ marginBottom: 18 }}>
          <Text variant="caption" tone="dim">CONVERSION</Text>
          <Text variant="title" weight="bold" tone="brand">
            {me.conversion_pct.toFixed(1)}%
          </Text>
        </Card>
      )}

      {incidents > 0 && (
        <Card style={{ marginBottom: 18, borderColor: colors.warning }}>
          <Text tone="warning" weight="semibold">⚠ {incidents} pending incident{incidents === 1 ? '' : 's'}</Text>
        </Card>
      )}

      {showTeam && team.length > 0 && (
        <>
          <Text variant="heading" weight="semibold" style={styles.h}>Team</Text>
          {team.slice(0, 8).map((m) => (
            <Card key={m.user_id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text weight="medium">{m.full_name}</Text>
                <Text tone="brand" weight="bold">{m.sales} sale{m.sales === 1 ? '' : 's'}</Text>
              </View>
              <Text tone="dim" variant="caption">
                {m.doors_knocked} knocks · {m.appointments} appts · {m.conversion_pct.toFixed(0)}%
              </Text>
            </Card>
          ))}
        </>
      )}

      <Text variant="heading" weight="semibold" style={styles.h}>Recent activity</Text>
      {recent.slice(0, 8).map((row) => (
        <Card key={row.id} style={{ marginBottom: 6 }}>
          <Text variant="caption" tone="dim">{new Date(row.ts).toLocaleString()}</Text>
          <Text weight="medium">{row.event_type.replace(/_/g, ' ')}</Text>
          {row.summary && <Text tone="dim" style={{ marginTop: 4 }}>{row.summary}</Text>}
        </Card>
      ))}
      {recent.length === 0 && !logsQ.isLoading && (
        <Text tone="mute" style={{ textAlign: 'center', marginTop: 12 }}>No activity yet.</Text>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'brand' }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" tone="dim">{label.toUpperCase()}</Text>
      <Text variant="display" weight="bold" tone={tone}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  greeting: { marginTop: 4, letterSpacing: 0.6 },
  name:     { marginBottom: 18 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  h:        { marginBottom: 10, marginTop: 6 },
});
