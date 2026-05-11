import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { managerApi, type OrgMember } from '@/api/manager';
import { Screen, Text, Card, Badge, Input, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

const ROLE_LABELS: Record<OrgMember['role'], string> = {
  admin:         'Admin',
  sales_manager: 'Manager',
  team_lead:     'Team Lead',
  sales_rep:     'Rep',
};
const ROLE_COLORS: Record<OrgMember['role'], 'purple' | 'blue' | 'orange' | 'gray'> = {
  admin:         'purple',
  sales_manager: 'blue',
  team_lead:     'orange',
  sales_rep:     'gray',
};

export default function PeopleScreen() {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['org-members'], queryFn: managerApi.orgMembers });
  const members = q.data?.data ?? [];

  const filtered = search
    ? members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()))
    : members;

  return (
    <Screen scrollable={false}>
      <Text variant="title" weight="bold">People</Text>
      <Text variant="caption" tone="dim" style={{ marginBottom: 12 }}>
        {members.length} member{members.length === 1 ? '' : 's'} in this org
      </Text>

      <Input value={search} onChangeText={setSearch} placeholder="Search by name…" />

      {q.isLoading ? (
        Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={56} borderRadius={10} style={{ marginBottom: 6 }} />)
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.user_id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', marginTop: 16 }}>
              <Text tone="dim">{search ? 'No matches' : 'No members yet.'}</Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text weight="semibold">{item.full_name}</Text>
              </View>
              <Badge label={ROLE_LABELS[item.role]} color={ROLE_COLORS[item.role]} dot />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
});
