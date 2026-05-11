import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { logsApi } from '@/api/logs';
import { api } from '@/api/client';
import { Text, Card, Button, Badge, Input, Modal, Select, type SelectOption } from '@/components/ui';
import { colors } from '@/lib/colors';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from '@/lib/leads';
import { LOG_EVENT_LABELS } from '@/lib/logs';
import { KnockCounter } from '@/components/dashboard/KnockCounter';
import { useProfile } from '@/hooks/useProfile';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList, LeadStatus, LogEventType, Tag, Lead } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadDetail'>;
type Tab = 'overview' | 'notes' | 'tags' | 'log' | 'ai';

export default function LeadDetailScreen({ route }: Props) {
  const { leadId } = route.params;
  const qc = useQueryClient();
  const { profile } = useProfile();
  const showKnockCounter = profile?.role === 'sales_rep' || profile?.role === 'team_lead';
  const [tab, setTab] = useState<Tab>('overview');
  const [logSaleOpen, setLogSaleOpen] = useState(false);

  const leadQ  = useQuery({ queryKey: ['lead', leadId],       queryFn: () => leadsApi.get(leadId) });
  const notesQ = useQuery({ queryKey: ['lead-notes', leadId], queryFn: () => leadsApi.notes(leadId) });
  const tagsQ  = useQuery({ queryKey: ['lead-tags', leadId],  queryFn: () => leadsApi.leadTags(leadId) });
  const logsQ  = useQuery({ queryKey: ['lead-logs', leadId],  queryFn: () => logsApi.list({ lead_id: leadId, page_size: 100 }) });

  const lead  = leadQ.data?.data;
  const notes = notesQ.data?.data ?? [];
  const tags  = tagsQ.data?.data ?? [];
  const logs  = logsQ.data?.data ?? [];

  const updateStatus = useMutation({
    mutationFn: (status: LeadStatus) => leadsApi.update(leadId, { status }),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['lead-logs', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (status === 'sold') setLogSaleOpen(true);
    },
    onError: (e: Error) => Alert.alert('Status update failed', e.message),
  });

  const dnk = useMutation({
    mutationFn: () => leadsApi.markDnk(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', leadId] }),
  });

  if (!lead) {
    return (
      <View style={styles.center}>
        <Text tone="dim">{leadQ.isLoading ? 'Loading…' : 'Lead not found.'}</Text>
      </View>
    );
  }

  function call() { if (lead?.phone) Linking.openURL(`tel:${lead.phone}`); }
  function nav() {
    if (lead?.address) Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`);
  }

  const tabsConfig: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'notes',    label: `Notes (${notes.length})` },
    { key: 'tags',     label: `Tags (${tags.length})` },
    { key: 'log',      label: `Log (${logs.length})` },
    { key: 'ai',       label: 'AI Coach' },
  ];

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {/* Header */}
      <View>
        <Text variant="title" weight="bold">{lead.address}</Text>
        <View style={styles.badgeRow}>
          <Badge label={LEAD_STATUS_LABELS[lead.status]} color={LEAD_STATUS_COLORS[lead.status]} dot />
          {lead.is_do_not_knock && <Badge label="DNK" color="red" />}
          {lead.is_opt_out && <Badge label="Opt-Out" color="red" />}
          {lead.carrier_availability?.att && <Badge label="AT&T Fiber" color="green" />}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.actionRow}>
        {lead.phone && <Button title={`Call ${lead.phone}`} onPress={call} variant="secondary" fullWidth={false} />}
        <Button title="Directions" onPress={nav} variant="secondary" fullWidth={false} />
        {!lead.is_do_not_knock && (
          <Button title="Mark DNK" onPress={() => dnk.mutate()} variant="danger" fullWidth={false} loading={dnk.isPending} />
        )}
      </View>

      {/* Pipeline status */}
      <Card style={{ marginTop: 16 }}>
        <Text variant="caption" tone="dim" style={styles.section}>PIPELINE STATUS</Text>
        <View style={styles.pipelineRow}>
          {LEAD_STATUS_ORDER.filter((s) => s !== 'closed_lost').map((s) => {
            const currentIdx = LEAD_STATUS_ORDER.indexOf(lead.status);
            const stepIdx = LEAD_STATUS_ORDER.indexOf(s);
            const done = stepIdx < currentIdx;
            const active = s === lead.status;
            return (
              <Pressable
                key={s}
                onPress={() => updateStatus.mutate(s)}
                style={[
                  styles.pipelineChip,
                  active && { backgroundColor: colors.brand },
                  done && !active && { backgroundColor: colors.brand + '33', borderColor: colors.brand },
                ]}
              >
                <Text
                  variant="caption"
                  weight="medium"
                  style={{ color: active ? '#fff' : done ? colors.brand : colors.textDim }}
                >
                  {LEAD_STATUS_LABELS[s]}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => updateStatus.mutate('closed_lost')}
            style={[
              styles.pipelineChip,
              { borderColor: colors.danger + '66' },
              lead.status === 'closed_lost' && { backgroundColor: colors.danger },
            ]}
          >
            <Text variant="caption" weight="medium" style={{ color: lead.status === 'closed_lost' ? '#fff' : colors.danger }}>
              Closed / Lost
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {tabsConfig.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text variant="caption" weight={tab === t.key ? 'semibold' : 'normal'} tone={tab === t.key ? 'brand' : 'dim'}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'overview' && <OverviewTab lead={lead} />}
      {tab === 'notes'    && <NotesTab leadId={leadId} notes={notes} />}
      {tab === 'tags'     && <TagsTab  leadId={leadId} leadTags={tags} />}
      {tab === 'log'      && <LogTab   logs={logs} />}
      {tab === 'ai'       && <AITab    address={lead.address} />}

      <LogSaleModal
        visible={logSaleOpen}
        leadId={leadId}
        onClose={() => setLogSaleOpen(false)}
        onSubmitted={() => {
          setLogSaleOpen(false);
          qc.invalidateQueries({ queryKey: ['lead-logs', leadId] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />
    </ScrollView>
    {showKnockCounter && <KnockCounter leadId={leadId} bottomOffset={20} />}
    </View>
  );
}

function OverviewTab({ lead }: { lead: Lead }) {
  return (
    <Card style={{ marginTop: 8 }}>
      <Field label="Address" value={lead.address} />
      <Field label="Coordinates" value={lead.lat != null && lead.lng != null ? `${lead.lat.toFixed(5)}, ${lead.lng.toFixed(5)}` : 'No coordinates'} />
      <Field label="Customer" value={lead.customer_name ?? '—'} />
      <Field label="Phone" value={lead.phone ?? '—'} />
      <Field label="Max Download" value={lead.carrier_availability?.max_down_mbps ? `${lead.carrier_availability.max_down_mbps} Mbps` : '—'} />
      <Field label="Technology" value={lead.carrier_availability?.tech_codes?.join(', ') || '—'} />
      <Field label="Source" value={lead.source ?? '—'} />
      <Field label="Created" value={new Date(lead.created_at).toLocaleString()} />
    </Card>
  );
}

function NotesTab({ leadId, notes }: { leadId: string; notes: Array<{ id: string; body: string; ts: string }> }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => leadsApi.addNote(leadId, body.trim()),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['lead-notes', leadId] }); },
  });
  return (
    <View style={{ marginTop: 8 }}>
      <Input value={body} onChangeText={setBody} placeholder="Add a note…" multiline />
      <Button title="Add note" onPress={() => m.mutate()} disabled={!body.trim()} loading={m.isPending} />
      <View style={{ marginTop: 12 }}>
        {notes.length === 0 ? (
          <Card style={{ alignItems: 'center' }}><Text tone="dim">No notes yet.</Text></Card>
        ) : notes.map((n) => (
          <Card key={n.id} style={{ marginBottom: 6 }}>
            <Text variant="caption" tone="dim">{new Date(n.ts).toLocaleString()}</Text>
            <Text style={{ marginTop: 4 }}>{n.body}</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}

function TagsTab({ leadId, leadTags }: { leadId: string; leadTags: Array<{ id: string; tag: Tag }> }) {
  const qc = useQueryClient();
  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: () => api.get<{ data: Tag[] }>('/api/tags') });
  const allTags = tagsQ.data?.data ?? [];
  const assignedIds = new Set(leadTags.map((lt) => lt.tag.id));

  const addTag = useMutation({
    mutationFn: (tagId: string) => leadsApi.tag(leadId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-tags', leadId] }),
  });
  const removeTag = useMutation({
    mutationFn: (tagId: string) => leadsApi.untag(leadId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-tags', leadId] }),
  });

  return (
    <View style={{ marginTop: 8 }}>
      <Text variant="caption" tone="dim" style={styles.section}>ASSIGNED</Text>
      <View style={styles.tagWrap}>
        {leadTags.length === 0 && <Text tone="dim">No tags assigned</Text>}
        {leadTags.map((lt) => (
          <Pressable key={lt.id} onPress={() => removeTag.mutate(lt.tag.id)}>
            <Badge label={`${lt.tag.name} ×`} color="blue" />
          </Pressable>
        ))}
      </View>
      <Text variant="caption" tone="dim" style={styles.section}>ADD TAG</Text>
      <View style={styles.tagWrap}>
        {allTags.filter((t) => !assignedIds.has(t.id)).map((t) => (
          <Pressable key={t.id} onPress={() => addTag.mutate(t.id)}>
            <Badge label={`+ ${t.name}`} color="gray" />
          </Pressable>
        ))}
        {allTags.length === 0 && <Text tone="mute" variant="caption">No tags configured yet. Add tags on the web.</Text>}
      </View>
    </View>
  );
}

function LogTab({ logs }: { logs: Array<{ id: string; event_type: LogEventType; summary: string; ts: string; is_incident: boolean }> }) {
  return (
    <View style={{ marginTop: 8 }}>
      {logs.length === 0 ? (
        <Card style={{ alignItems: 'center' }}><Text tone="dim">No activity yet.</Text></Card>
      ) : logs.map((row) => (
        <Card key={row.id} style={{ marginBottom: 6 }}>
          <Text variant="caption" tone="dim">{new Date(row.ts).toLocaleString()}</Text>
          <Text weight="medium">{LOG_EVENT_LABELS[row.event_type] ?? row.event_type}</Text>
          {row.summary && <Text tone="dim" style={{ marginTop: 4 }}>{row.summary}</Text>}
          {row.is_incident && <Badge label="Incident" color="red" style={{ marginTop: 4 }} />}
        </Card>
      ))}
    </View>
  );
}

function AITab({ address }: { address: string }) {
  return (
    <Card style={{ marginTop: 8 }}>
      <Text variant="caption" tone="dim">AI COACH — REBUTTALS FOR THIS LEAD</Text>
      <Text tone="dim" style={{ marginTop: 6 }}>
        Per-lead rebuttal suggestions are coming. For now, open AI Coach from the More tab — the
        coach has access to your org's competitor intel and Q&A library.
      </Text>
      <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>Lead: {address}</Text>
    </Card>
  );
}

function LogSaleModal({
  visible, leadId, onClose, onSubmitted,
}: { visible: boolean; leadId: string; onClose: () => void; onSubmitted: () => void }) {
  const [packageName, setPackageName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => logsApi.create({
      lead_id: leadId,
      event_type: 'sale_submitted',
      summary: `Submitted sale${packageName ? `: ${packageName}` : ''}${monthlyAmount ? ` — $${monthlyAmount}/mo` : ''}`,
      metadata: {
        package: packageName || undefined,
        monthly_amount: monthlyAmount ? Number(monthlyAmount) : undefined,
        payment_method: paymentMethod || undefined,
      },
    }),
    onSuccess: () => onSubmitted(),
    onError: (e: Error) => Alert.alert('Log sale failed', e.message),
  });

  const methods: SelectOption<string>[] = [
    { value: 'card',         label: 'Credit / debit' },
    { value: 'cashapp',      label: 'CashApp' },
    { value: 'paypal',       label: 'PayPal' },
    { value: 'invoice',      label: 'Invoice' },
    { value: 'company_plan', label: 'Company plan' },
  ];

  return (
    <Modal visible={visible} onClose={onClose} title="Submit sale">
      <ScrollView>
        <Input label="Package / plan" value={packageName} onChangeText={setPackageName} placeholder="e.g. Fiber 1 Gig" />
        <Input label="Monthly amount ($)" value={monthlyAmount} onChangeText={setMonthlyAmount} keyboardType="decimal-pad" />
        <Select label="Payment method" value={paymentMethod} onChange={setPaymentMethod} options={methods} />
        <Button title="Submit for verification" onPress={() => m.mutate()} loading={m.isPending} />
      </ScrollView>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text variant="caption" tone="dim">{label.toUpperCase()}</Text>
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 16 },
  badgeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  section:       { marginTop: 8, marginBottom: 8, letterSpacing: 0.6 },
  pipelineRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pipelineChip:  {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  tabBar:        { gap: 16, paddingVertical: 12, marginTop: 14, marginBottom: 4 },
  tabBtn:        { paddingVertical: 4, paddingHorizontal: 2, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:  { borderBottomColor: colors.brand },
  tagWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
});
