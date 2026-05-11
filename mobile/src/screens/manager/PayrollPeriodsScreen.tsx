import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi, type PayPeriod } from '@/api/payroll';
import { Screen, Text, Card, Badge, Button, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

const STATUS_COLORS: Record<PayPeriod['status'], 'gray' | 'yellow' | 'green'> = {
  open:     'yellow',
  closed:   'gray',
  released: 'green',
};

export default function PayrollPeriodsScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pay-periods'], queryFn: payrollApi.periods });

  const create = useMutation({
    mutationFn: () => payrollApi.createPeriod(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pay-periods'] }),
    onError: (e: Error) => Alert.alert('Create failed', e.message),
  });

  const generate = useMutation({
    mutationFn: (id: string) => payrollApi.generateStubs(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pay-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-stubs'] });
      Alert.alert('Stubs generated', `${res.generated} paystub${res.generated === 1 ? '' : 's'} created.`);
    },
    onError: (e: Error) => Alert.alert('Generate failed', e.message),
  });

  const periods = q.data?.data ?? [];

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Payroll Periods</Text>
      <Text variant="caption" tone="dim">Create periods and generate paystubs</Text>

      <Button
        title="+ Create current-week period"
        onPress={() => create.mutate()}
        loading={create.isPending}
        style={{ marginTop: 12 }}
      />

      {q.isLoading ? (
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />)}
        </View>
      ) : periods.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}><Text tone="dim">No pay periods yet.</Text></Card>
      ) : (
        <View style={{ marginTop: 12 }}>
          {periods.map((p) => (
            <PeriodRow
              key={p.id}
              period={p}
              onGenerate={() => generate.mutate(p.id)}
              generating={generate.isPending && generate.variables === p.id}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PeriodRow({ period, onGenerate, generating }: { period: PayPeriod; onGenerate: () => void; generating: boolean }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">
            {new Date(period.period_start).toLocaleDateString()} – {new Date(period.period_end).toLocaleDateString()}
          </Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>Created {new Date(period.created_at).toLocaleDateString()}</Text>
        </View>
        <Badge label={period.status} color={STATUS_COLORS[period.status]} dot />
      </View>
      {period.status === 'open' && (
        <Button
          title="Generate stubs"
          onPress={onGenerate}
          loading={generating}
          variant="secondary"
          style={{ marginTop: 10 }}
        />
      )}
    </Card>
  );
}
