import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { managerApi } from '@/api/manager';
import { Screen, Text, Card, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

const ROLE_COLORS = {
  admin: 'purple', sales_manager: 'blue', team_lead: 'orange', sales_rep: 'gray',
} as const;

export default function TeamScreen() {
  const q = useQuery({ queryKey: ['my-team'], queryFn: managerApi.myTeam });

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={80} borderRadius={12} style={{ marginBottom: 12 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={64} borderRadius={10} style={{ marginBottom: 6 }} />
        ))}
      </Screen>
    );
  }

  if (!q.data?.data) {
    return (
      <Screen>
        <Text variant="title" weight="bold">My Team</Text>
        <Card style={{ marginTop: 16, alignItems: 'center' }}>
          <Text tone="dim">{q.data?.message ?? 'Not assigned to a team.'}</Text>
          <Text variant="caption" tone="mute" style={{ marginTop: 4, textAlign: 'center' }}>
            Ask an admin to add you to a team to see member stats here.
          </Text>
        </Card>
      </Screen>
    );
  }

  const { team, members } = q.data.data;
  const totalLeads = members.reduce((sum, m) => sum + m.leads_count, 0);
  const totalSales = members.reduce((sum, m) => sum + m.sales_this_month, 0);

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text variant="title" weight="bold">{team.name}</Text>
          <Text variant="caption" tone="dim">Tier {team.tier} · {members.length} member{members.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {/* Team stats */}
      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <Text variant="caption" tone="dim">TOTAL LEADS</Text>
          <Text variant="display" weight="bold">{totalLeads}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text variant="caption" tone="dim">SALES THIS MONTH</Text>
          <Text variant="display" weight="bold" tone="brand">{totalSales}</Text>
        </Card>
      </View>

      <Text variant="caption" tone="dim" style={styles.section}>MEMBERS</Text>
      {members.length === 0 ? (
        <Card style={{ alignItems: 'center' }}><Text tone="dim">No members yet.</Text></Card>
      ) : (
        members
          .slice()
          .sort((a, b) => b.sales_this_month - a.sales_this_month)
          .map((m) => (
            <Card key={m.user_id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text weight="semibold">{m.full_name}</Text>
                    <Badge label={m.role.replace('_', ' ')} color={ROLE_COLORS[m.role]} dot />
                  </View>
                  <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>
                    {m.leads_count} leads · {m.sales_this_month} sale{m.sales_this_month === 1 ? '' : 's'} this month
                  </Text>
                </View>
                <Text variant="title" weight="bold" tone="brand">{m.sales_this_month}</Text>
              </View>
            </Card>
          ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid:     { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1 },
  section:  { marginTop: 16, marginBottom: 8, letterSpacing: 0.6 },
});
