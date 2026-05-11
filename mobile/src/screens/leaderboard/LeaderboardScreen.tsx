import React, { useState } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, type LeaderboardEntry, type Metric, type Period } from '@/api/leaderboard';
import { Screen, Text, Card, Skeleton, Badge } from '@/components/ui';
import { colors } from '@/lib/colors';

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: 'sales',        label: 'Sales' },
  { key: 'appointments', label: 'Appts' },
  { key: 'doors',        label: 'Doors' },
  { key: 'training',     label: 'Training' },
];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Week' },
  { key: 'month',   label: 'Month' },
  { key: 'alltime', label: 'All Time' },
];

export default function LeaderboardScreen() {
  const [metric, setMetric] = useState<Metric>('sales');
  const [period, setPeriod] = useState<Period>('week');

  const q = useQuery({
    queryKey: ['leaderboard', metric, period],
    queryFn:  () => leaderboardApi.list({ metric, period }),
  });

  const entries = q.data?.data ?? [];

  return (
    <Screen scrollable={false}>
      <Text variant="title" weight="bold" style={{ marginBottom: 4 }}>Leaderboard</Text>
      <Text variant="caption" tone="dim" style={{ marginBottom: 12 }}>Motivational ranking · org-wide</Text>

      {/* Metric tabs */}
      <View style={styles.tabRow}>
        {METRICS.map((m) => (
          <Pressable key={m.key} onPress={() => setMetric(m.key)} style={[styles.tab, metric === m.key && styles.tabActive]}>
            <Text variant="caption" weight={metric === m.key ? 'semibold' : 'normal'} tone={metric === m.key ? 'brand' : 'dim'}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Period chips */}
      <View style={styles.chipRow}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[styles.chip, period === p.key && styles.chipActive]}>
            <Text variant="caption" tone={period === p.key ? 'default' : 'dim'}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={56} borderRadius={10} style={{ marginBottom: 6 }} />)
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.user_id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', marginTop: 24 }}>
              <Text tone="dim">No entries yet for this period.</Text>
            </Card>
          }
          renderItem={({ item }) => <LeaderRow entry={item} metric={metric} />}
        />
      )}
    </Screen>
  );
}

function LeaderRow({ entry, metric }: { entry: LeaderboardEntry; metric: Metric }) {
  const value =
    metric === 'sales' ? entry.sales :
    metric === 'appointments' ? entry.appointments :
    metric === 'doors' ? entry.doors :
    entry.training_modules;

  const subValue =
    metric === 'training' ? `${entry.training_pct.toFixed(0)}% complete` :
    metric === 'sales' && entry.goal !== null ? `Goal ${entry.goal} · ${(entry.goal_pct ?? 0).toFixed(0)}%` :
    entry.team_name ?? '';

  return (
    <Card style={[styles.row, entry.is_me && { borderColor: colors.brand, borderWidth: 1.5 }]}>
      <View style={styles.rankCircle}>
        <Text variant="caption" weight="bold" tone={entry.rank <= 3 ? 'brand' : 'dim'}>
          {entry.rank}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{entry.full_name}</Text>
          {entry.is_me && <Badge label="You" color="blue" />}
        </View>
        {subValue ? <Text variant="caption" tone="dim">{subValue}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="heading" weight="bold" tone="brand">{value}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabRow:     { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 10, padding: 4, marginBottom: 10 },
  tab:        { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive:  { backgroundColor: colors.bg, borderColor: colors.brand, borderWidth: 1 },
  chipRow:    { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand + '22', borderColor: colors.brand },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  rankCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center' },
});
