import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logsApi } from '@/api/logs';
import { Screen, Text, Card, Badge, Button, Modal, Input, Skeleton } from '@/components/ui';
import { LOG_EVENT_LABELS } from '@/lib/logs';
import { colors } from '@/lib/colors';
import type { SalesActivityLog, LogEventType, SignoffAction } from '@/types';

export default function ComplianceScreen() {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState<SalesActivityLog | null>(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState<SignoffAction | null>(null);

  const q = useQuery({
    queryKey: ['compliance-incidents'],
    queryFn:  () => logsApi.list({ incidents_only: true, page_size: 100 }),
  });

  const signoff = useMutation({
    mutationFn: () => logsApi.signoff(reviewing!.id, action!, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-incidents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setReviewing(null);
      setNote('');
      setAction(null);
    },
    onError: (e: Error) => Alert.alert('Sign-off failed', e.message),
  });

  const incidents = q.data?.data ?? [];

  // Split by whether they have signoffs (would need to fetch signoffs separately
  // — for now show all incidents; tap to act)
  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Compliance</Text>
      <Text variant="caption" tone="dim">Incident log · review & acknowledge</Text>

      {q.isLoading ? (
        <View style={{ marginTop: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />
          ))}
        </View>
      ) : incidents.length === 0 ? (
        <Card style={{ alignItems: 'center', marginTop: 16 }}>
          <Text tone="success">✓ No incidents on file.</Text>
          <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>Compliance violations show up here automatically.</Text>
        </Card>
      ) : (
        <View style={{ marginTop: 12 }}>
          {incidents.map((log) => (
            <IncidentRow
              key={log.id}
              log={log}
              onReview={() => setReviewing(log)}
            />
          ))}
        </View>
      )}

      <Modal
        visible={!!reviewing}
        onClose={() => { setReviewing(null); setNote(''); setAction(null); }}
        title="Review incident"
      >
        {reviewing && (
          <View>
            <Badge label={LOG_EVENT_LABELS[reviewing.event_type] ?? reviewing.event_type} color="red" dot />
            <Text style={{ marginTop: 8 }}>{reviewing.summary}</Text>
            <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>
              {new Date(reviewing.ts).toLocaleString()}
            </Text>

            <Input
              label="Sign-off note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional context…"
              multiline
              style={{ marginTop: 12 }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button
                title="Acknowledge"
                onPress={() => { setAction('acknowledged'); signoff.mutate(); }}
                variant="secondary"
                fullWidth={false}
                style={{ flex: 1 }}
                loading={signoff.isPending && action === 'acknowledged'}
              />
              <Button
                title="Deny"
                onPress={() => { setAction('denied'); signoff.mutate(); }}
                variant="danger"
                fullWidth={false}
                style={{ flex: 1 }}
                loading={signoff.isPending && action === 'denied'}
              />
            </View>
          </View>
        )}
      </Modal>
    </Screen>
  );
}

function IncidentRow({ log, onReview }: { log: SalesActivityLog; onReview: () => void }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Badge label={LOG_EVENT_LABELS[log.event_type as LogEventType] ?? log.event_type} color="red" dot />
          <Text style={{ marginTop: 6 }}>{log.summary}</Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>{new Date(log.ts).toLocaleString()}</Text>
        </View>
        <Button title="Review" onPress={onReview} variant="primary" fullWidth={false} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({});
