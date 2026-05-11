import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { Text, Card, Input, StatusPill, Button } from '@/components/ui';
import { colors } from '@/lib/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList, LeadStatus } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadsList'>;

const STATUS_FILTERS: Array<LeadStatus | 'all'> = ['all', 'new', 'attempted', 'contacted', 'qualified', 'appointment_set', 'sold'];

export default function LeadsScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');

  const q = useQuery({
    queryKey: ['leads', { filter }],
    queryFn: () =>
      leadsApi.list({
        ...(filter !== 'all' && { status: filter }),
        page_size: 200,
      }),
  });

  const filteredLeads = (q.data?.data ?? []).filter((l) =>
    !search
      ? true
      : (l.address?.toLowerCase().includes(search.toLowerCase()) ||
         l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
         l.phone?.includes(search)),
  );


  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search address, name, phone…"
          autoCapitalize="none"
          style={{ marginBottom: 8 }}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(s) => s}
          contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item)}
              style={[styles.chip, filter === item && styles.chipActive]}
            >
              <Text variant="caption" tone={filter === item ? 'default' : 'dim'}>
                {item === 'all' ? 'All' : item.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filteredLeads}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        refreshing={q.isFetching && !q.isLoading}
        onRefresh={() => q.refetch()}
        ListEmptyComponent={
          q.isLoading ? null : (
            <Text tone="mute" style={{ textAlign: 'center', marginTop: 48 }}>
              No leads match your filter.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{item.address}</Text>
              <StatusPill status={item.status as LeadStatus} />
            </View>
            {item.customer_name && <Text tone="dim" variant="caption">{item.customer_name}</Text>}
            {item.phone && <Text tone="mute" variant="caption">{item.phone}</Text>}
          </Card>
        )}
      />

      <View style={styles.fabRow}>
        <Button title="+ New Lead" onPress={() => navigation.navigate('NewLead')} fullWidth={false} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg },
  header:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 80 },
  chip:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand + '22', borderColor: colors.brand },
  fabRow:     { position: 'absolute', bottom: 16, right: 16 },
});
