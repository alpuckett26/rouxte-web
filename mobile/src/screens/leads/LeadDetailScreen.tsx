import React from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { logsApi } from '@/api/logs';
import { Text, Card, Button, StatusPill } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList, LeadStatus, LogEventType } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadDetail'>;

interface QuickAction {
  type: LogEventType;
  label: string;
  summary: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

const QUICK_ACTIONS: QuickAction[] = [
  { type: 'door_knock',          label: 'Door knock',     summary: 'Knocked',                  variant: 'secondary' },
  { type: 'appointment_set',     label: 'Appt set',       summary: 'Appointment set',          variant: 'primary'   },
  { type: 'appointment_completed', label: 'Appt done',    summary: 'Appointment completed',    variant: 'secondary' },
  { type: 'sale_submitted',      label: 'Sale submitted', summary: 'Sale submitted',           variant: 'primary'   },
  { type: 'no_solicit_observed', label: 'No-solicit',     summary: 'No-solicit sign observed', variant: 'danger'    },
  { type: 'do_not_knock_marked', label: 'DNK',            summary: 'Marked do-not-knock',      variant: 'danger'    },
];

export default function LeadDetailScreen({ route }: Props) {
  const { leadId } = route.params;
  const qc = useQueryClient();

  const leadQ = useQuery({ queryKey: ['lead', leadId], queryFn: () => leadsApi.get(leadId) });
  const logsQ = useQuery({ queryKey: ['lead-logs', leadId], queryFn: () => logsApi.list({ lead_id: leadId, page_size: 100 }) });
  const lead = leadQ.data?.data;

  const logM = useMutation({
    mutationFn: ({ event_type, summary }: { event_type: LogEventType; summary: string }) =>
      logsApi.create({ lead_id: leadId, event_type, summary }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-logs', leadId] });
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: (e: Error) => Alert.alert('Could not log event', e.message),
  });

  function call() {
    if (lead?.phone) Linking.openURL(`tel:${lead.phone}`);
  }
  function nav() {
    if (lead?.address) Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`);
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text tone="dim">{leadQ.isLoading ? 'Loading…' : 'Lead not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text variant="heading" weight="semibold" style={{ flex: 1 }}>{lead.address}</Text>
        <StatusPill status={lead.status as LeadStatus} />
      </View>
      {lead.customer_name && <Text tone="dim" style={{ marginTop: 4 }}>{lead.customer_name}</Text>}

      <View style={styles.actionRow}>
        {lead.phone && <Button title={`Call ${lead.phone}`} onPress={call} variant="secondary" fullWidth={false} />}
        <Button title="Directions" onPress={nav} variant="secondary" fullWidth={false} />
      </View>

      <Text variant="caption" tone="dim" style={styles.sect}>QUICK LOG</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <Button
            key={a.type}
            title={a.label}
            onPress={() => logM.mutate({ event_type: a.type, summary: a.summary })}
            variant={a.variant ?? 'secondary'}
            fullWidth={false}
            style={{ flexBasis: '48%' }}
          />
        ))}
      </View>

      <Text variant="caption" tone="dim" style={styles.sect}>TIMELINE</Text>
      {(logsQ.data?.data ?? []).map((row) => (
        <Card key={row.id} style={{ marginBottom: 6 }}>
          <Text variant="caption" tone="dim">{new Date(row.ts).toLocaleString()}</Text>
          <Text weight="medium">{row.event_type.replace(/_/g, ' ')}</Text>
          {row.summary && <Text tone="dim" style={{ marginTop: 4 }}>{row.summary}</Text>}
          {row.is_incident && <Text variant="caption" tone="warning" style={{ marginTop: 4 }}>⚠ Incident</Text>}
        </Card>
      ))}
      {(logsQ.data?.data ?? []).length === 0 && (
        <Text tone="mute" style={{ textAlign: 'center', marginTop: 24 }}>No events yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  sect:      { marginTop: 24, marginBottom: 8, letterSpacing: 0.6 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
