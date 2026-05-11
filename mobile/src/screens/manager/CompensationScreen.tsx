import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { compensationApi, type SalesTierRow } from '@/api/compensation';
import { Screen, Text, Card, Input, Button, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

interface TierEdit { id: string; name: string; commission_pct: number; }

export default function CompensationScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sales-tiers'], queryFn: compensationApi.tiers });
  const [edits, setEdits] = useState<Record<string, TierEdit>>({});

  useEffect(() => {
    if (!q.data?.data) return;
    const map: Record<string, TierEdit> = {};
    for (const t of q.data.data) {
      map[t.id] = { id: t.id, name: t.name, commission_pct: t.commission_pct };
    }
    setEdits(map);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => compensationApi.updateTiers(
      Object.values(edits).map((t) => ({ id: t.id, name: t.name, commission_pct: t.commission_pct })),
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-tiers'] });
      qc.invalidateQueries({ queryKey: ['compensation-me'] });
      Alert.alert('Saved', 'Commission tiers updated.');
    },
    onError: (e: Error) => Alert.alert('Save failed', e.message),
  });

  const dirty = q.data?.data?.some((t) => {
    const e = edits[t.id];
    return e && (e.name !== t.name || e.commission_pct !== t.commission_pct);
  }) ?? false;

  if (q.isLoading) {
    return (
      <Screen>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 8 }} />)}
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Compensation</Text>
      <Text variant="caption" tone="dim">Edit commission percentages per tier. Assigned to reps via Settings.</Text>

      {(q.data?.data ?? []).map((tier) => {
        const e = edits[tier.id];
        if (!e) return null;
        return (
          <Card key={tier.id} style={{ marginTop: 12 }}>
            <Text variant="caption" tone="dim">TIER {tier.display_order + 1}</Text>
            <Input
              label="Name"
              value={e.name}
              onChangeText={(v) => setEdits((prev) => ({ ...prev, [tier.id]: { ...prev[tier.id], name: v } }))}
            />
            <Input
              label="Commission percent"
              value={String(e.commission_pct)}
              onChangeText={(v) => setEdits((prev) => ({
                ...prev,
                [tier.id]: { ...prev[tier.id], commission_pct: Number(v.replace(/[^0-9.]/g, '')) || 0 },
              }))}
              keyboardType="decimal-pad"
            />
            <Text variant="caption" tone="mute">{e.commission_pct.toFixed(1)}% per qualifying sale</Text>
          </Card>
        );
      })}

      <View style={{ marginTop: 18 }}>
        <Button
          title={save.isPending ? 'Saving…' : 'Save changes'}
          onPress={() => save.mutate()}
          disabled={!dirty}
          loading={save.isPending}
        />
      </View>

      <Text variant="caption" tone="mute" style={{ marginTop: 12, textAlign: 'center' }}>
        Pay periods + chargeback rules are still web-only.
      </Text>
    </Screen>
  );
}
