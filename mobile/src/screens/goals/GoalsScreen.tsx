import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { goalsApi } from '@/api/goals';
import { Screen, Text, Card, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function GoalsScreen() {
  const q = useQuery({ queryKey: ['goal-progress'], queryFn: goalsApi.progress });

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={120} borderRadius={12} style={{ marginBottom: 12 }} />
        <Skeleton height={80} borderRadius={12} style={{ marginBottom: 8 }} />
      </Screen>
    );
  }

  if (!q.data?.data) {
    return (
      <Screen>
        <Text variant="title" weight="bold">Goals</Text>
        <Card style={{ marginTop: 16, alignItems: 'center' }}>
          <Text tone="dim">{q.data?.message ?? 'No active goal assigned yet.'}</Text>
          <Text variant="caption" tone="mute" style={{ marginTop: 8, textAlign: 'center' }}>
            Your manager can assign weekly or monthly goals on the web.
          </Text>
        </Card>
      </Screen>
    );
  }

  const { goal, period, progress, standing } = q.data.data;
  const goalCount = goal.min_sales_count;
  const pct = goalCount > 0 ? Math.min(100, (progress.count / goalCount) * 100) : 0;
  const revenueGoal = goal.min_revenue ?? 0;
  const revPct = revenueGoal > 0 ? Math.min(100, (progress.revenue / revenueGoal) * 100) : 0;

  const standingColor =
    standing === 'terminated' ? 'red' :
    standing === 'at_risk'    ? 'orange' :
    'green';

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text variant="title" weight="bold">Goal Progress</Text>
          <Text variant="caption" tone="dim">{period.label} · {period.days_left}d left</Text>
        </View>
        <Badge label={standing.replace('_', ' ')} color={standingColor as never} dot />
      </View>

      {/* Sales count */}
      <Card style={{ marginTop: 16 }}>
        <Text variant="caption" tone="dim">SALES</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <Text variant="display" weight="bold" tone={progress.goal_met ? 'success' : 'brand'}>
            {progress.count}
          </Text>
          <Text tone="dim">/ {goalCount}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: progress.goal_met ? colors.success : colors.brand }]} />
        </View>
        <Text variant="caption" tone={progress.goal_met ? 'success' : 'dim'} style={{ marginTop: 4 }}>
          {progress.goal_met ? '✓ Goal met' : `${(goalCount - progress.count).toFixed(0)} sale${goalCount - progress.count === 1 ? '' : 's'} to go`}
        </Text>
      </Card>

      {/* Revenue */}
      {revenueGoal > 0 && (
        <Card style={{ marginTop: 10 }}>
          <Text variant="caption" tone="dim">REVENUE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <Text variant="display" weight="bold">${progress.revenue.toFixed(2)}</Text>
            <Text tone="dim">/ ${revenueGoal.toFixed(2)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${revPct}%`, backgroundColor: colors.brand }]} />
          </View>
        </Card>
      )}

      <Card style={{ marginTop: 16 }}>
        <Text variant="caption" tone="dim">GOAL TYPE</Text>
        <Text weight="medium" style={{ marginTop: 4 }}>{goal.period_type === 'weekly' ? 'Weekly' : 'Monthly'} target</Text>
        <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>
          Period: {new Date(period.start).toLocaleDateString()} – {new Date(period.end).toLocaleDateString()}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.bgInput, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  fill:  { height: 8, borderRadius: 4 },
});
