import React, { useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachApi, type CoachQA } from '@/api/coach';
import { Screen, Text, Card, Input, Button, Badge, Modal, Select, Skeleton, type SelectOption } from '@/components/ui';
import { colors } from '@/lib/colors';

type Tab = 'qa' | 'competitors';

const CATEGORY_OPTIONS: SelectOption<CoachQA['category']>[] = [
  { value: 'objection', label: 'Objection' },
  { value: 'rebuttal',  label: 'Rebuttal' },
  { value: 'pitch',     label: 'Pitch' },
  { value: 'opening',   label: 'Opening' },
  { value: 'closing',   label: 'Closing' },
  { value: 'followup',  label: 'Follow-up' },
];

const CATEGORY_COLORS: Record<CoachQA['category'], 'blue' | 'red' | 'purple' | 'orange' | 'green' | 'yellow'> = {
  objection: 'red',
  rebuttal:  'red',
  pitch:     'blue',
  opening:   'purple',
  closing:   'green',
  followup:  'yellow',
};

export default function CoachScreen() {
  const [tab, setTab] = useState<Tab>('qa');

  return (
    <Screen scrollable={false}>
      <Text variant="title" weight="bold">Coach Knowledge</Text>
      <Text variant="caption" tone="dim">What Rex says to your reps</Text>

      <View style={styles.tabRow}>
        <TabBtn label="Q&A scripts"  active={tab === 'qa'}          onPress={() => setTab('qa')} />
        <TabBtn label="Competitors"  active={tab === 'competitors'} onPress={() => setTab('competitors')} />
      </View>

      {tab === 'qa' ? <QATab /> : <CompetitorsTab />}
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

function QATab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['coach-qa'], queryFn: coachApi.qaList });
  const [addOpen, setAddOpen] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [category, setCategory] = useState<CoachQA['category']>('objection');

  const addMutation = useMutation({
    mutationFn: () => coachApi.qaCreate({ trigger: trigger.trim(), response: response.trim(), category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach-qa'] });
      setAddOpen(false); setTrigger(''); setResponse(''); setCategory('objection');
    },
    onError: (e: Error) => Alert.alert('Add failed', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coachApi.qaDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-qa'] }),
  });

  const list = q.data?.data ?? [];

  return (
    <>
      <Button title="+ Add script" onPress={() => setAddOpen(true)} variant="primary" style={{ marginTop: 12 }} />

      {q.isLoading ? (
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />)}
        </View>
      ) : list.length === 0 ? (
        <Card style={{ marginTop: 12, alignItems: 'center' }}><Text tone="dim">No Q&A scripts yet.</Text></Card>
      ) : (
        <View style={{ marginTop: 12 }}>
          {list.map((qa) => (
            <Card key={qa.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Badge label={qa.category} color={CATEGORY_COLORS[qa.category]} dot />
                {qa.use_count > 0 && <Text variant="caption" tone="mute">used {qa.use_count}×</Text>}
              </View>
              <Text weight="semibold" style={{ marginTop: 2 }}>"{qa.trigger}"</Text>
              <Text tone="dim" style={{ marginTop: 6 }}>{qa.response}</Text>
              <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                <Button
                  title="Delete"
                  onPress={() => Alert.alert('Delete script?', `"${qa.trigger}"`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(qa.id) },
                  ])}
                  variant="ghost"
                  fullWidth={false}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      <Modal visible={addOpen} onClose={() => setAddOpen(false)} title="Add script">
        <Input
          label='Trigger (what the prospect says)'
          value={trigger}
          onChangeText={setTrigger}
          placeholder='"We already have cable"'
          multiline
        />
        <Input
          label="Response (what the rep should say)"
          value={response}
          onChangeText={setResponse}
          placeholder="That's actually exactly why I'm here…"
          multiline
        />
        <Select label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <Button
          title="Save"
          onPress={() => addMutation.mutate()}
          loading={addMutation.isPending}
          disabled={!trigger.trim() || !response.trim()}
        />
      </Modal>
    </>
  );
}

function CompetitorsTab() {
  const q = useQuery({ queryKey: ['competitor-intel'], queryFn: coachApi.competitors });
  const list = q.data?.data ?? [];

  if (q.isLoading) {
    return (
      <View style={{ marginTop: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={72} borderRadius={12} style={{ marginBottom: 6 }} />)}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12 }}>
      <Text variant="caption" tone="mute" style={{ marginBottom: 8 }}>
        Rex uses this pricing intel for "compete with ___" rebuttals. Edit on the web.
      </Text>
      {list.length === 0 ? (
        <Card style={{ alignItems: 'center' }}><Text tone="dim">No competitor intel.</Text></Card>
      ) : (
        list.map((c) => (
          <Card key={c.id} style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{c.competitor} · {c.plan_name}</Text>
                <Text variant="caption" tone="dim">
                  {c.download_mbps ? `${c.download_mbps}/${c.upload_mbps ?? '?'}Mbps` : 'Speed unknown'}
                  {c.contract_required && ' · contract'}
                  {c.data_cap_gb && ` · ${c.data_cap_gb}GB cap`}
                </Text>
                {c.notes && <Text variant="caption" tone="mute" style={{ marginTop: 2 }}>{c.notes}</Text>}
              </View>
              <Text variant="title" weight="bold" tone="brand">${c.monthly_price}</Text>
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow:    { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 10, padding: 4, marginTop: 12 },
  tab:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.bg, borderColor: colors.brand, borderWidth: 1 },
});
