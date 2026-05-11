import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { managerApi, type FunnelStats } from '@/api/manager';
import { Screen, Text, Card, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function ManagerSmartPitchScreen() {
  const q = useQuery({ queryKey: ['manager-funnels'], queryFn: managerApi.funnels });
  const funnels = q.data?.data ?? [];

  const totals = funnels.reduce(
    (acc, f) => ({
      hot:    acc.hot + f.hot_count,
      warm:   acc.warm + f.warm_count,
      cold:   acc.cold + f.cold_count,
      total:  acc.total + f.total_submissions,
      active: acc.active + (f.active ? 1 : 0),
    }),
    { hot: 0, warm: 0, cold: 0, total: 0, active: 0 },
  );

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">SmartPitch (Manager)</Text>
      <Text variant="caption" tone="dim">All rep funnels in your org</Text>

      <View style={styles.grid}>
        <Stat label="Active funnels" value={totals.active}                       />
        <Stat label="Total subs"     value={totals.total}                        />
        <Stat label="Hot"            value={totals.hot}  color="red"             />
        <Stat label="Warm"           value={totals.warm} color="orange"          />
      </View>

      <Text variant="caption" tone="dim" style={styles.section}>BY REP</Text>
      {q.isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={88} borderRadius={12} style={{ marginBottom: 6 }} />)
      ) : funnels.length === 0 ? (
        <Card style={{ alignItems: 'center' }}><Text tone="dim">No funnels created yet.</Text></Card>
      ) : (
        funnels.map((f) => <FunnelRow key={f.rep_id} f={f} />)
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: 'red' | 'orange' }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" tone="dim">{label.toUpperCase()}</Text>
      <Text variant="title" weight="bold" tone={color === 'red' ? 'danger' : color === 'orange' ? 'warning' : 'default'}>{value}</Text>
    </Card>
  );
}

function FunnelRow({ f }: { f: FunnelStats }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{f.full_name}</Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>{f.slug}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Badge label={`${f.hot_count} hot`}   color="red" />
            <Badge label={`${f.warm_count} warm`} color="orange" />
            <Badge label={`${f.cold_count} cold`} color="gray" />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="title" weight="bold" tone="brand">{f.total_submissions}</Text>
          <Text variant="caption" tone="mute">subs</Text>
          {!f.active && <Badge label="Inactive" color="red" style={{ marginTop: 4 }} />}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  section:  { marginTop: 16, marginBottom: 8, letterSpacing: 0.6 },
});
