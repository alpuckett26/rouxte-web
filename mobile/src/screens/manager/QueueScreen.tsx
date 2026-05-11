import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi, type PendingSale } from '@/api/manager';
import { Screen, Text, Card, Badge, Button, Modal, Input, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

type Tab = 'pending' | 'verified' | 'rejected';

export default function QueueScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [reviewing, setReviewing] = useState<PendingSale | null>(null);
  const [pendingAction, setPendingAction] = useState<'sale_verified' | 'sale_rejected' | null>(null);
  const [note, setNote] = useState('');

  const q = useQuery({ queryKey: ['sales-queue'], queryFn: managerApi.queue });

  const signoff = useMutation({
    mutationFn: () => managerApi.signoff(reviewing!.id, pendingAction!, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-queue'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      setReviewing(null);
      setPendingAction(null);
      setNote('');
    },
    onError: (e: Error) => Alert.alert('Sign-off failed', e.message),
  });

  const pending  = q.data?.pending ?? [];
  const verified = q.data?.verified ?? [];
  const rejected = q.data?.rejected ?? [];
  const list = tab === 'pending' ? pending : tab === 'verified' ? verified : rejected;

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Sales Queue</Text>
      <Text variant="caption" tone="dim">Verify submitted sales before they hit payroll</Text>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        <TabBtn label={`Pending (${pending.length})`}   active={tab === 'pending'}   onPress={() => setTab('pending')} />
        <TabBtn label={`Verified (${verified.length})`} active={tab === 'verified'}  onPress={() => setTab('verified')} />
        <TabBtn label={`Rejected (${rejected.length})`} active={tab === 'rejected'}  onPress={() => setTab('rejected')} />
      </View>

      {q.isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={88} borderRadius={12} style={{ marginBottom: 6 }} />)
      ) : list.length === 0 ? (
        <Card style={{ alignItems: 'center', marginTop: 16 }}>
          <Text tone="dim">No {tab} sales.</Text>
        </Card>
      ) : (
        list.map((sale) => (
          <SaleRow
            key={sale.id}
            sale={sale}
            isPending={tab === 'pending'}
            onReview={() => setReviewing(sale)}
          />
        ))
      )}

      {/* Review modal */}
      <Modal visible={!!reviewing} onClose={() => { setReviewing(null); setPendingAction(null); setNote(''); }} title="Review sale">
        {reviewing && (
          <View>
            <Text weight="semibold">{reviewing.full_name}</Text>
            {reviewing.lead_address && <Text tone="dim" style={{ marginTop: 4 }}>{reviewing.lead_address}</Text>}
            {reviewing.customer_name && <Text variant="caption" tone="dim">{reviewing.customer_name}</Text>}
            {typeof reviewing.metadata?.package === 'string' && (
              <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>Package: {reviewing.metadata.package as string}</Text>
            )}
            {typeof reviewing.metadata?.monthly_amount === 'number' && (
              <Text variant="caption" tone="mute">Monthly: ${(reviewing.metadata.monthly_amount as number).toFixed(2)}</Text>
            )}
            {reviewing.summary && <Text style={{ marginTop: 8 }}>{reviewing.summary}</Text>}

            <Input
              label="Manager note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Reason for decision…"
              multiline
              style={{ marginTop: 12 }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button
                title="Reject"
                onPress={() => { setPendingAction('sale_rejected'); signoff.mutate(); }}
                variant="danger"
                fullWidth={false}
                style={{ flex: 1 }}
                loading={signoff.isPending && pendingAction === 'sale_rejected'}
              />
              <Button
                title="Verify"
                onPress={() => { setPendingAction('sale_verified'); signoff.mutate(); }}
                variant="primary"
                fullWidth={false}
                style={{ flex: 1 }}
                loading={signoff.isPending && pendingAction === 'sale_verified'}
              />
            </View>
          </View>
        )}
      </Modal>
    </Screen>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text variant="caption" weight={active ? 'semibold' : 'normal'} tone={active ? 'brand' : 'dim'}>{label}</Text>
    </Pressable>
  );
}

function SaleRow({ sale, isPending, onReview }: { sale: PendingSale; isPending: boolean; onReview: () => void }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{sale.full_name}</Text>
          {sale.lead_address && <Text variant="caption" tone="dim" numberOfLines={1}>{sale.lead_address}</Text>}
          {sale.customer_name && <Text variant="caption" tone="mute">{sale.customer_name}</Text>}
          {typeof sale.metadata?.package === 'string' && (
            <Text variant="caption" tone="mute" style={{ marginTop: 2 }}>{sale.metadata.package as string}</Text>
          )}
          {typeof sale.metadata?.monthly_amount === 'number' && (
            <Text variant="caption" tone="brand" style={{ marginTop: 2 }}>${(sale.metadata.monthly_amount as number).toFixed(2)}/mo</Text>
          )}
        </View>
        <Text variant="caption" tone="mute">{new Date(sale.created_at).toLocaleDateString()}</Text>
      </View>

      {isPending && (
        <View style={{ marginTop: 10 }}>
          <Button title="Review" onPress={onReview} variant="primary" />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabRow:    { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 10, padding: 4, marginTop: 12, marginBottom: 12 },
  tab:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.bg, borderColor: colors.brand, borderWidth: 1 },
});
