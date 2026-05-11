import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi, type TeamWithStats } from '@/api/manager';
import { Screen, Text, Card, Button, Input, Modal, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function TeamsScreen() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [teamName, setTeamName] = useState('');

  const q = useQuery({ queryKey: ['teams'], queryFn: managerApi.teams });

  const create = useMutation({
    mutationFn: () => managerApi.createTeam(teamName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setAddOpen(false);
      setTeamName('');
    },
    onError: (e: Error) => Alert.alert('Create failed', e.message),
  });

  const teams = q.data?.data ?? [];

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Teams</Text>
      <Text variant="caption" tone="dim">{teams.length} team{teams.length === 1 ? '' : 's'}</Text>

      <Button title="+ New team" onPress={() => setAddOpen(true)} style={{ marginTop: 12 }} />

      {q.isLoading ? (
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={80} borderRadius={12} style={{ marginBottom: 6 }} />)}
        </View>
      ) : teams.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}><Text tone="dim">No teams yet.</Text></Card>
      ) : (
        <View style={{ marginTop: 12 }}>
          {teams.map((team) => <TeamRow key={team.id} team={team} />)}
        </View>
      )}

      <Text variant="caption" tone="mute" style={{ marginTop: 16, textAlign: 'center' }}>
        Assigning reps to teams is still web-only.
      </Text>

      <Modal visible={addOpen} onClose={() => setAddOpen(false)} title="New team">
        <Input
          label="Team name"
          value={teamName}
          onChangeText={setTeamName}
          placeholder="e.g. Houston East"
          autoFocus
        />
        <Button title="Create" onPress={() => create.mutate()} loading={create.isPending} disabled={!teamName.trim()} />
      </Modal>
    </Screen>
  );
}

function TeamRow({ team }: { team: TeamWithStats }) {
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{team.name}</Text>
          <Text variant="caption" tone="dim">Tier {team.tier} · {team.member_count} member{team.member_count === 1 ? '' : 's'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="title" weight="bold" tone="brand">{team.sales_this_month}</Text>
          <Text variant="caption" tone="mute">sales this month</Text>
        </View>
      </View>
    </Card>
  );
}
