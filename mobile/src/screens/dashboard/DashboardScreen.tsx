import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { useProfile } from '@/hooks/useProfile';
import { Screen, Text, Card } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function DashboardScreen() {
  const { profile } = useProfile();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const today = q.data?.today ?? { knocks: 0, contacts: 0, appointments: 0, sales: 0 };

  return (
    <Screen
      loading={q.isLoading}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="caption" tone="dim" style={styles.greeting}>WELCOME BACK</Text>
      <Text variant="title" weight="bold" style={styles.name}>
        {profile?.full_name ?? 'Friend'}
      </Text>

      <View style={styles.grid}>
        <Stat label="Knocks"        value={today.knocks}        />
        <Stat label="Contacts"      value={today.contacts}      />
        <Stat label="Appointments"  value={today.appointments}  />
        <Stat label="Sales"         value={today.sales}         tone="brand" />
      </View>

      <Text variant="heading" weight="semibold" style={styles.h}>Recent activity</Text>
      {(q.data?.recent_activity ?? []).slice(0, 8).map((row) => (
        <Card key={row.id} style={styles.row}>
          <Text variant="caption" tone="dim">{new Date(row.created_at).toLocaleString()}</Text>
          <Text weight="medium">{row.event_type.replace(/_/g, ' ')}</Text>
          {row.notes && <Text tone="dim" style={{ marginTop: 4 }}>{row.notes}</Text>}
        </Card>
      ))}
      {(q.data?.recent_activity ?? []).length === 0 && !q.isLoading && (
        <Text tone="mute" style={{ textAlign: 'center', marginTop: 24 }}>No activity yet today.</Text>
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
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  h:        { marginBottom: 10 },
  row:      { marginBottom: 8, borderColor: colors.border },
});
