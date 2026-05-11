import React, { useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsManagerApi, type GoalWithAssigner } from '@/api/goalsManager';
import { managerApi } from '@/api/manager';
import { Screen, Text, Card, Input, Button, Badge, Modal, Select, Skeleton, type SelectOption } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function GoalsManagerScreen() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const q = useQuery({ queryKey: ['goals-manager'], queryFn: goalsManagerApi.list });
  const goals = q.data?.data ?? [];

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Goals</Text>
      <Text variant="caption" tone="dim">Set weekly or monthly sales targets per rep or team</Text>

      <Button title="+ Add goal" onPress={() => setAddOpen(true)} style={{ marginTop: 12 }} />

      {q.isLoading ? (
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />)}
        </View>
      ) : goals.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}><Text tone="dim">No active goals.</Text></Card>
      ) : (
        <View style={{ marginTop: 12 }}>
          {goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)}
        </View>
      )}

      <AddGoalModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['goals-manager'] });
          setAddOpen(false);
        }}
      />
    </Screen>
  );
}

function GoalRow({ goal }: { goal: GoalWithAssigner }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Badge label={goal.period_type} color="blue" />
            {goal.user_id && <Badge label="Per-rep" color="purple" />}
            {goal.team_id && <Badge label="Team" color="orange" />}
          </View>
          <Text weight="semibold" style={{ marginTop: 6 }}>{goal.min_sales_count} sale{goal.min_sales_count === 1 ? '' : 's'}</Text>
          {goal.min_revenue && <Text variant="caption" tone="dim">≥ ${goal.min_revenue.toFixed(2)} revenue</Text>}
          {goal.team_lead_bonus && <Text variant="caption" tone="success">+${goal.team_lead_bonus} team lead bonus</Text>}
          <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>
            From {new Date(goal.effective_from).toLocaleDateString()}
            {goal.effective_to && ` to ${new Date(goal.effective_to).toLocaleDateString()}`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function AddGoalModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [scope, setScope] = useState<'user' | 'team'>('user');
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [minSales, setMinSales] = useState('');
  const [minRevenue, setMinRevenue] = useState('');

  const members = useQuery({ queryKey: ['org-members'], queryFn: managerApi.orgMembers, enabled: visible });
  const teams   = useQuery({ queryKey: ['teams'],       queryFn: managerApi.teams,      enabled: visible });

  const create = useMutation({
    mutationFn: () => goalsManagerApi.create({
      user_id: scope === 'user' ? userId : null,
      team_id: scope === 'team' ? teamId : null,
      period_type: periodType,
      min_sales_count: Number(minSales) || 0,
      min_revenue: minRevenue ? Number(minRevenue) : undefined,
    }),
    onSuccess: onCreated,
    onError: (e: Error) => Alert.alert('Create failed', e.message),
  });

  const userOptions: SelectOption<string>[] = (members.data?.data ?? [])
    .filter((m) => m.role === 'sales_rep' || m.role === 'team_lead')
    .map((m) => ({ value: m.user_id, label: m.full_name }));

  const teamOptions: SelectOption<string>[] = (teams.data?.data ?? [])
    .map((t) => ({ value: t.id, label: `${t.name} (${t.member_count})` }));

  const canSubmit = Boolean(minSales) && ((scope === 'user' && userId) || (scope === 'team' && teamId));

  return (
    <Modal visible={visible} onClose={onClose} title="New goal">
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        <Pressable
          onPress={() => setScope('user')}
          style={[styles.chip, scope === 'user' && styles.chipActive]}
        >
          <Text variant="caption" tone={scope === 'user' ? 'default' : 'dim'}>Per rep</Text>
        </Pressable>
        <Pressable
          onPress={() => setScope('team')}
          style={[styles.chip, scope === 'team' && styles.chipActive]}
        >
          <Text variant="caption" tone={scope === 'team' ? 'default' : 'dim'}>Per team</Text>
        </Pressable>
      </View>

      {scope === 'user' ? (
        <Select label="Rep" value={userId} onChange={setUserId} options={userOptions} />
      ) : (
        <Select label="Team" value={teamId} onChange={setTeamId} options={teamOptions} />
      )}

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        <Pressable
          onPress={() => setPeriodType('weekly')}
          style={[styles.chip, periodType === 'weekly' && styles.chipActive]}
        >
          <Text variant="caption" tone={periodType === 'weekly' ? 'default' : 'dim'}>Weekly</Text>
        </Pressable>
        <Pressable
          onPress={() => setPeriodType('monthly')}
          style={[styles.chip, periodType === 'monthly' && styles.chipActive]}
        >
          <Text variant="caption" tone={periodType === 'monthly' ? 'default' : 'dim'}>Monthly</Text>
        </Pressable>
      </View>

      <Input label="Min sales count" value={minSales} onChangeText={setMinSales} keyboardType="number-pad" />
      <Input label="Min revenue ($, optional)" value={minRevenue} onChangeText={setMinRevenue} keyboardType="decimal-pad" />

      <Button title="Create goal" onPress={() => create.mutate()} disabled={!canSubmit} loading={create.isPending} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  chip:       { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: colors.brand + '22', borderColor: colors.brand },
});
