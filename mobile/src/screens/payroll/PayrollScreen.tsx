import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { payrollApi, type PayStub } from '@/api/payroll';
import { Screen, Text, Card, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function PayrollScreen() {
  const q = useQuery({ queryKey: ['payroll-stubs'], queryFn: payrollApi.stubs });

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={120} borderRadius={12} style={{ marginBottom: 12 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />
        ))}
      </Screen>
    );
  }

  const stubs = q.data?.data ?? [];
  const released = stubs.filter((s) => s.status === 'released');
  const ytdEarnings = released.reduce((sum, s) => sum + (s.net_pay ?? 0), 0);
  const ytdSales = released.reduce((sum, s) => sum + (s.sales_count ?? 0), 0);

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Payroll</Text>

      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text variant="caption" tone="dim">YTD EARNINGS</Text>
          <Text variant="display" weight="bold" tone="brand">${ytdEarnings.toFixed(2)}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text variant="caption" tone="dim">YTD SALES</Text>
          <Text variant="display" weight="bold">{ytdSales}</Text>
        </Card>
      </View>

      <Text variant="caption" tone="dim" style={styles.section}>PAYSTUBS</Text>
      {stubs.length === 0 ? (
        <Card style={{ alignItems: 'center' }}>
          <Text tone="dim">No paystubs yet.</Text>
          <Text variant="caption" tone="mute" style={{ marginTop: 4, textAlign: 'center' }}>
            Paystubs appear once your manager releases a pay period.
          </Text>
        </Card>
      ) : (
        stubs.map((s) => <StubRow key={s.id} stub={s} />)
      )}
    </Screen>
  );
}

function StubRow({ stub }: { stub: PayStub }) {
  const period = `${new Date(stub.period_start).toLocaleDateString()} – ${new Date(stub.period_end).toLocaleDateString()}`;
  const statusColor = stub.status === 'released' ? 'green' : stub.status === 'approved' ? 'yellow' : 'gray';
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{period}</Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>
            {stub.sales_count} sale{stub.sales_count === 1 ? '' : 's'} · {stub.pay_type}
          </Text>
          {stub.manager_notes && (
            <Text variant="caption" tone="mute" style={{ marginTop: 4, fontStyle: 'italic' }}>"{stub.manager_notes}"</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="heading" weight="bold" tone="brand">${stub.net_pay.toFixed(2)}</Text>
          <Badge label={stub.status} color={statusColor as never} dot />
        </View>
      </View>

      {(stub.gross_commission > 0 || stub.bonus > 0 || stub.chargebacks > 0) && (
        <View style={styles.breakdown}>
          {stub.gross_commission > 0 && <BreakdownRow label="Commission"  value={stub.gross_commission} />}
          {stub.bonus > 0            && <BreakdownRow label="Bonus"       value={stub.bonus} />}
          {stub.chargebacks > 0      && <BreakdownRow label="Chargebacks" value={-stub.chargebacks} tone="danger" />}
        </View>
      )}
    </Card>
  );
}

function BreakdownRow({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
      <Text variant="caption" tone="dim">{label}</Text>
      <Text variant="caption" tone={tone ?? 'default'}>{value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid:      { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
  statCard:  { flex: 1 },
  section:   { marginTop: 14, marginBottom: 8, letterSpacing: 0.6 },
  breakdown: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
