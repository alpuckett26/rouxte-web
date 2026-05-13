import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leadsApi } from '@/api/leads';
import { api } from '@/api/client';
import { Text, Button, Card, Badge, Skeleton, Modal, Select, type SelectOption } from '@/components/ui';
import { colors } from '@/lib/colors';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_ORDER } from '@/lib/leads';
import { useProfile, canBulkAssign } from '@/hooks/useProfile';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList, LeadStatus, Lead } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadsList'>;

const PAGE_SIZE = 100;
type CarrierFilter = 'all' | 'att';
type Scope = 'mine' | 'org';

export default function LeadsScreen({ navigation }: Props) {
  const { profile } = useProfile();
  const isManager = canBulkAssign(profile?.role);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState<CarrierFilter>('all');
  // Manager-only scope toggle. Reps always see their own leads via RLS.
  const [scope, setScope] = useState<Scope>('org');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const q = useQuery({
    queryKey: ['leads', { statusFilter, carrierFilter, scope, page, userId: profile?.user_id }],
    queryFn:  () => leadsApi.list({
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(carrierFilter === 'att' && { carrier: 'att' }),
      ...(isManager && scope === 'mine' && profile?.user_id && { assigned_to: profile.user_id }),
      page,
      page_size: PAGE_SIZE,
    }),
  });

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const leads = useMemo(() => {
    const all = q.data?.data ?? [];
    if (!search) return all;
    const s = search.toLowerCase();
    return all.filter(
      (l) =>
        l.address?.toLowerCase().includes(s) ||
        l.customer_name?.toLowerCase().includes(s) ||
        l.phone?.includes(search),
    );
  }, [q.data, search]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        total={total}
        isManager={isManager}
        selectMode={selectMode}
        selectedCount={selected.size}
        onNewLead={() => navigation.navigate('NewLead')}
        onCancelSelect={exitSelectMode}
        onAssign={() => setAssignOpen(true)}
      />

      <FilterBar
        statusFilter={statusFilter}
        onStatusFilter={(s) => { setStatusFilter(s); setPage(1); }}
        carrierFilter={carrierFilter}
        onCarrierFilter={(c) => { setCarrierFilter(c); setPage(1); }}
        scope={scope}
        onScope={(s) => { setScope(s); setPage(1); }}
        showScope={isManager}
      />

      {q.isLoading ? (
        <View style={styles.skeletonList}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={72} borderRadius={12} style={{ marginBottom: 6 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          refreshing={q.isFetching && !q.isLoading}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<EmptyState isManager={isManager} />}
          ListFooterComponent={
            totalPages > 1 ? <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} /> : null
          }
          renderItem={({ item }) => (
            <LeadRow
              lead={item}
              selected={selected.has(item.id)}
              selectMode={selectMode && isManager}
              onPress={() => {
                if (selectMode && isManager) toggleSelect(item.id);
                else navigation.navigate('LeadDetail', { leadId: item.id });
              }}
              onLongPress={() => {
                if (isManager) {
                  setSelectMode(true);
                  toggleSelect(item.id);
                }
              }}
            />
          )}
        />
      )}

      <BulkAssignModal
        visible={assignOpen}
        leadIds={Array.from(selected)}
        onClose={() => setAssignOpen(false)}
        onSuccess={() => {
          setAssignOpen(false);
          exitSelectMode();
          qc.invalidateQueries({ queryKey: ['leads'] });
        }}
      />
    </SafeAreaView>
  );
}

function Header({
  total, isManager, selectMode, selectedCount, onNewLead, onCancelSelect, onAssign,
}: {
  total: number; isManager: boolean; selectMode: boolean; selectedCount: number;
  onNewLead: () => void; onCancelSelect: () => void; onAssign: () => void;
}) {
  const nav = useNavigation();
  if (selectMode && isManager) {
    return (
      <View style={[styles.header, { backgroundColor: colors.brand + '22' }]}>
        <View>
          <Text weight="semibold" tone="brand">{selectedCount} selected</Text>
          <Text variant="caption" tone="dim">Tap to add/remove</Text>
        </View>
        <View style={styles.headerActions}>
          <Button title="Assign" onPress={onAssign} variant="primary" fullWidth={false} disabled={selectedCount === 0} />
          <Button title="Cancel" onPress={onCancelSelect} variant="ghost" fullWidth={false} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text variant="heading" weight="semibold">Leads</Text>
        <Text variant="caption" tone="dim">{total > 0 ? `${total.toLocaleString()} total` : 'Your pipeline'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <NotificationBell onPress={() => nav.navigate('More' as never, { screen: 'Notifications' } as never)} />
        <Button title="+ Add" onPress={onNewLead} variant="primary" fullWidth={false} />
      </View>
    </View>
  );
}

function FilterBar({
  statusFilter, onStatusFilter, carrierFilter, onCarrierFilter,
  scope, onScope, showScope,
}: {
  statusFilter: LeadStatus | 'all'; onStatusFilter: (s: LeadStatus | 'all') => void;
  carrierFilter: CarrierFilter; onCarrierFilter: (c: CarrierFilter) => void;
  scope: Scope; onScope: (s: Scope) => void; showScope: boolean;
}) {
  return (
    <View style={styles.filterBar}>
      {showScope && (
        <View style={styles.carrierRow}>
          <Pressable
            onPress={() => onScope('org')}
            style={[styles.chip, styles.chipSmall, scope === 'org' && styles.chipActive]}
          >
            <Text variant="caption" tone={scope === 'org' ? 'default' : 'dim'}>All org</Text>
          </Pressable>
          <Pressable
            onPress={() => onScope('mine')}
            style={[styles.chip, styles.chipSmall, scope === 'mine' && styles.chipActive]}
          >
            <Text variant="caption" tone={scope === 'mine' ? 'default' : 'dim'}>Assigned to me</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', ...LEAD_STATUS_ORDER] as const}
        keyExtractor={(s) => s}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onStatusFilter(item)}
            style={[styles.chip, statusFilter === item && styles.chipActive]}
          >
            <Text variant="caption" tone={statusFilter === item ? 'default' : 'dim'}>
              {item === 'all' ? 'All' : LEAD_STATUS_LABELS[item]}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.carrierRow}>
        <Pressable
          onPress={() => onCarrierFilter('all')}
          style={[styles.chip, styles.chipSmall, carrierFilter === 'all' && styles.chipActive]}
        >
          <Text variant="caption" tone={carrierFilter === 'all' ? 'default' : 'dim'}>Any carrier</Text>
        </Pressable>
        <Pressable
          onPress={() => onCarrierFilter('att')}
          style={[styles.chip, styles.chipSmall, carrierFilter === 'att' && styles.chipActive]}
        >
          <Text variant="caption" tone={carrierFilter === 'att' ? 'default' : 'dim'}>AT&T fiber only</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LeadRow({
  lead, selected, selectMode, onPress, onLongPress,
}: {
  lead: Lead; selected: boolean; selectMode: boolean;
  onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <Card style={[styles.row, selected && { borderColor: colors.brand, backgroundColor: colors.brand + '11' }]}>
        {selectMode && (
          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
            {selected && <Text style={{ color: 'white' }}>✓</Text>}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{lead.address}</Text>
            <Badge label={LEAD_STATUS_LABELS[lead.status]} color={LEAD_STATUS_COLORS[lead.status]} dot />
          </View>
          <View style={styles.rowMeta}>
            {lead.customer_name && <Text variant="caption" tone="dim">{lead.customer_name}</Text>}
            {lead.carrier_availability?.att && <Text variant="caption" tone="success">· AT&T fiber</Text>}
            {lead.phone && <Text variant="caption" tone="mute">· {lead.phone}</Text>}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyState({ isManager }: { isManager: boolean }) {
  return (
    <View style={styles.empty}>
      <Text tone="dim" weight="medium">No leads match your filter.</Text>
      {isManager && (
        <Text variant="caption" tone="mute" style={{ marginTop: 8, textAlign: 'center' }}>
          Import leads on the web for now.
        </Text>
      )}
    </View>
  );
}

function Pagination({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  return (
    <View style={styles.pagination}>
      <Text variant="caption" tone="mute">
        Page {page} of {totalPages} · {total.toLocaleString()} total
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Button title="Previous" onPress={() => onPage(Math.max(1, page - 1))} disabled={page === 1} variant="secondary" fullWidth={false} />
        <Button title="Next" onPress={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} variant="secondary" fullWidth={false} />
      </View>
    </View>
  );
}

function BulkAssignModal({
  visible, leadIds, onClose, onSuccess,
}: { visible: boolean; leadIds: string[]; onClose: () => void; onSuccess: () => void }) {
  const [pick, setPick] = useState<string | null>(null);

  const reps = useQuery({
    queryKey: ['team-members'],
    queryFn:  () => api.get<{ data: Array<{ user_id: string; full_name: string; role: string }> }>('/api/team/members'),
    enabled:  visible,
  });

  const m = useMutation({
    mutationFn: (userId: string | null) => leadsApi.bulkAssign(leadIds, userId),
    onSuccess: () => onSuccess(),
  });

  const repsList = (reps.data?.data ?? []).filter((r) => r.role === 'sales_rep' || r.role === 'team_lead');
  const options: SelectOption<string>[] = [
    { value: '__unassign__', label: 'Unassign all' },
    ...repsList.map((r) => ({ value: r.user_id, label: r.full_name })),
  ];

  return (
    <Modal visible={visible} onClose={onClose} title={`Assign ${leadIds.length} lead${leadIds.length === 1 ? '' : 's'}`}>
      <Select
        label="Assign to"
        value={pick}
        onChange={setPick}
        options={options}
        placeholder="Pick a rep…"
      />
      <Button
        title={pick === '__unassign__' ? 'Unassign' : 'Assign'}
        onPress={() => m.mutate(pick === '__unassign__' ? null : pick)}
        loading={m.isPending}
        disabled={!pick}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  header:       { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions:{ flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterBar:    { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  chipRow:      { gap: 6, paddingVertical: 2 },
  carrierRow:   { flexDirection: 'row', gap: 6 },
  chip:         { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipSmall:    { paddingHorizontal: 10 },
  chipActive:   { backgroundColor: colors.brand + '22', borderColor: colors.brand },
  list:         { paddingHorizontal: 16, paddingBottom: 24 },
  skeletonList: { paddingHorizontal: 16, paddingTop: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  rowTop:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  checkbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn:   { backgroundColor: colors.brand, borderColor: colors.brand },
  empty:        { paddingVertical: 56, alignItems: 'center' },
  pagination:   { paddingTop: 20, alignItems: 'center' },
});
