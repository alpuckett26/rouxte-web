import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { dashboardApi } from '@/api/dashboard';
import { repApi, type SaleEntry, type ActivityEntry } from '@/api/rep';
import { aiApi } from '@/api/ai';
import { useProfile, isManager, isFullManager } from '@/hooks/useProfile';
import { Screen, Text, Card, Badge, Skeleton, SkeletonGrid } from '@/components/ui';
import { colors } from '@/lib/colors';
import { LOG_EVENT_LABELS } from '@/lib/logs';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { KnockCounter } from '@/components/dashboard/KnockCounter';
import { TrialBanner } from '@/components/TrialBanner';
import type { MainTabParamList, LogEventType, UserRole } from '@/types';

type Nav = BottomTabNavigationProp<MainTabParamList>;

const HEADINGS: Record<UserRole, { title: string; sub: string }> = {
  admin:         { title: 'Owner Dashboard',     sub: 'Org-wide overview' },
  sales_manager: { title: 'Manager Dashboard',   sub: 'Your team at a glance' },
  team_lead:     { title: 'Team Lead Dashboard', sub: 'Your performance & team' },
  sales_rep:     { title: 'Dashboard',           sub: 'Your performance at a glance' },
};

export default function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = useProfile();
  const role = profile?.role;
  const isElevated = isManager(role);
  const isFull = isFullManager(role);

  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const salesQ = useQuery({
    queryKey: ['rep-sales'],
    queryFn:  repApi.sales,
    enabled:  !isElevated && !!role,
  });
  const aiUsage = useQuery({
    queryKey: ['ai-usage'],
    queryFn:  aiApi.usage,
    enabled:  role === 'sales_rep' || role === 'team_lead',
  });

  const heading = role ? HEADINGS[role] : HEADINGS.sales_rep;
  const me = dashQ.data?.rep_stats;
  const team = dashQ.data?.team_stats ?? [];
  const incidents = dashQ.data?.pending_incidents ?? 0;

  const showKnockCounter = role === 'sales_rep' || role === 'team_lead';

  return (
    <View style={{ flex: 1 }}>
    <TrialBanner />
    <Screen
      refreshing={dashQ.isFetching && !dashQ.isLoading}
      onRefresh={() => { dashQ.refetch(); salesQ.refetch(); aiUsage.refetch(); }}
    >
      {/* Heading */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" weight="semibold">{heading.title}</Text>
          <Text variant="caption" tone="dim">{heading.sub}</Text>
        </View>
        <NotificationBell onPress={() => nav.navigate('More' as never, { screen: 'Notifications' } as never)} />
      </View>

      {/* Incident banner */}
      {isElevated && incidents > 0 && (
        <Pressable onPress={() => nav.navigate('More', { screen: 'Manager' } as never)}>
          <Card style={styles.incidentBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.pulseDot} />
              <Text tone="danger" weight="medium" style={{ flex: 1 }}>
                {incidents} incident{incidents > 1 ? 's' : ''} pending review
              </Text>
              <Text tone="danger" weight="semibold" variant="caption">Review →</Text>
            </View>
          </Card>
        </Pressable>
      )}

      {/* Personal stats */}
      <Text variant="caption" tone="dim" style={styles.section}>
        {isElevated ? 'MY PERSONAL STATS' : 'MY STATS'}
      </Text>
      {dashQ.isLoading ? <SkeletonGrid count={4} height={88} /> : (
        <View style={styles.grid}>
          <StatBox label="Doors Knocked" value={me?.doors_knocked ?? 0} />
          <StatBox label="Contacts"      value={me?.contacts ?? 0}      />
          <StatBox label="Appointments"  value={me?.appointments ?? 0}  />
          <StatBox
            label="Sales"
            value={me?.sales ?? 0}
            sub={`${(me?.conversion_pct ?? 0).toFixed(1)}% conversion`}
            highlight
          />
        </View>
      )}

      {/* Team leaderboard */}
      {isElevated && team.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="caption" tone="dim">TEAM LEADERBOARD</Text>
            {isFull && (
              <Pressable onPress={() => nav.navigate('More', { screen: 'Manager' } as never)}>
                <Text variant="caption" tone="brand">Full view →</Text>
              </Pressable>
            )}
          </View>
          <Card style={{ padding: 0, marginBottom: 16 }}>
            <View style={styles.tableHeader}>
              <Text variant="caption" tone="dim" style={{ width: 24 }}>#</Text>
              <Text variant="caption" tone="dim" style={{ flex: 1 }}>Rep</Text>
              <Text variant="caption" tone="dim" style={styles.colNum}>Knocked</Text>
              <Text variant="caption" tone="dim" style={styles.colNum}>Sales</Text>
              <Text variant="caption" tone="dim" style={styles.colNum}>Conv</Text>
            </View>
            {team.slice(0, 10).map((rep, i) => (
              <View key={rep.user_id} style={styles.tableRow}>
                <Text variant="caption" tone="mute" style={{ width: 24 }}>{i + 1}</Text>
                <Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>{rep.full_name}</Text>
                <Text variant="caption" tone="dim" style={styles.colNum}>{rep.doors_knocked}</Text>
                <Text variant="caption" tone="success" weight="semibold" style={styles.colNum}>{rep.sales}</Text>
                <Text variant="caption" tone="mute" style={styles.colNum}>{rep.conversion_pct.toFixed(1)}%</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Rep sales widget (non-elevated only) */}
      {!isElevated && (
        <RepSalesWidget
          sales={salesQ.data?.sales ?? []}
          activity={salesQ.data?.activity ?? []}
          loading={salesQ.isLoading}
        />
      )}

      {/* Quick Actions */}
      <Text variant="caption" tone="dim" style={styles.section}>QUICK ACTIONS</Text>
      <Card style={{ marginBottom: 12 }}>
        <QuickAction label="Open Field Map"     onPress={() => nav.navigate('Map' as never)} />
        <QuickAction label="View All Leads"     onPress={() => nav.navigate('Leads' as never)} />
        {isFull && (
          <QuickAction label="Review Queue"     onPress={() => nav.navigate('More', { screen: 'Manager' } as never)} tone="warning" />
        )}
        {isFull && (
          <QuickAction label="Payroll"          onPress={() => nav.navigate('More', { screen: 'Payroll' } as never)} tone="warning" />
        )}
        {role === 'admin' && (
          <QuickAction label="Manage People"    onPress={() => nav.navigate('More', { screen: 'Manager' } as never)} tone="warning" />
        )}
        {!isFull && (
          <QuickAction label="My Paystubs"      onPress={() => nav.navigate('More', { screen: 'Payroll' } as never)} />
        )}
      </Card>

      {/* AI usage (rep + team_lead) */}
      {(role === 'sales_rep' || role === 'team_lead') && aiUsage.data && (
        <>
          <Text variant="caption" tone="dim" style={styles.section}>AI COACHING USAGE</Text>
          <Card style={{ marginBottom: 12 }}>
            <UsageBar label="Today"      value={aiUsage.data.prompts_used}       max={3}  color={colors.brand} />
            <UsageBar label="Total cap"  value={aiUsage.data.total_prompts_used} max={15} color="#a855f7" />
            <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>
              Team tiers unlock additional AI prompts.
            </Text>
          </Card>
        </>
      )}
    </Screen>
    {showKnockCounter && <KnockCounter bottomOffset={84} />}
    </View>
  );
}

function StatBox({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" tone="dim" style={{ textTransform: 'uppercase' }}>{label}</Text>
      <Text variant="display" weight="bold" tone={highlight ? 'brand' : 'default'}>
        {value}
      </Text>
      {sub && <Text variant="caption" tone="mute">{sub}</Text>}
    </Card>
  );
}

function QuickAction({ label, onPress, tone = 'brand' }: { label: string; onPress: () => void; tone?: 'brand' | 'warning' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.6 }]}>
      <Text tone={tone}>→</Text>
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

function UsageBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text variant="caption" tone="dim">{label}</Text>
        <Text variant="caption" tone="dim">{value} / {max}</Text>
      </View>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { backgroundColor: color, width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function RepSalesWidget({ sales, activity, loading }: { sales: SaleEntry[]; activity: ActivityEntry[]; loading: boolean }) {
  const [tab, setTab] = useState<'sales' | 'activity'>('sales');
  const pending  = sales.filter((s) => s.status === 'pending').length;
  const verified = sales.filter((s) => s.status === 'verified').length;
  const rejected = sales.filter((s) => s.status === 'rejected').length;

  return (
    <>
      <Text variant="caption" tone="dim" style={styles.section}>MY SUBMITTED SALES</Text>

      <View style={styles.pillRow}>
        <Badge label={`${pending} Pending`}   color="yellow" />
        <Badge label={`${verified} Verified`} color="green" />
        {rejected > 0 && <Badge label={`${rejected} Rejected`} color="red" />}
      </View>

      <View style={styles.tabSwitch}>
        <Pressable onPress={() => setTab('sales')}    style={[styles.tab, tab === 'sales' && styles.tabActive]}>
          <Text variant="caption" weight={tab === 'sales' ? 'semibold' : 'normal'}>My Sales</Text>
        </Pressable>
        <Pressable onPress={() => setTab('activity')} style={[styles.tab, tab === 'activity' && styles.tabActive]}>
          <Text variant="caption" weight={tab === 'activity' ? 'semibold' : 'normal'}>Activity</Text>
        </Pressable>
      </View>

      {loading ? (
        <Skeleton height={64} style={{ marginBottom: 6 }} />
      ) : tab === 'sales' ? (
        sales.length === 0 ? (
          <Card style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text tone="dim">No submitted sales yet</Text>
          </Card>
        ) : (
          sales.map((s) => (
            <Card key={s.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  {s.lead_address && <Text weight="medium" numberOfLines={1}>{s.lead_address}</Text>}
                  {s.customer_name && <Text variant="caption" tone="dim">{s.customer_name}</Text>}
                  {typeof s.metadata?.package === 'string' && (
                    <Text variant="caption" tone="mute" style={{ marginTop: 2 }}>{s.metadata.package as string}</Text>
                  )}
                  {s.signoff_note && (
                    <Text variant="caption" tone="dim" style={{ marginTop: 4, fontStyle: 'italic' }}>"{s.signoff_note}"</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={s.status === 'verified' ? 'Verified' : s.status === 'rejected' ? 'Rejected' : 'Pending'}
                    color={s.status === 'verified' ? 'green' : s.status === 'rejected' ? 'red' : 'yellow'}
                  />
                  <Text variant="caption" tone="mute">{new Date(s.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
            </Card>
          ))
        )
      ) : activity.length === 0 ? (
        <Card style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text tone="dim">No recent activity</Text>
        </Card>
      ) : (
        activity.map((a) => (
          <View key={a.id} style={styles.activityRow}>
            <View style={styles.activityDot} />
            <View style={{ flex: 1 }}>
              <Text>{a.summary}</Text>
              <Text variant="caption" tone="mute">
                {LOG_EVENT_LABELS[a.event_type as LogEventType] ?? a.event_type} · {new Date(a.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  incidentBanner:  { borderColor: '#ef4444', backgroundColor: '#ef444411', marginBottom: 16 },
  pulseDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  section:         { marginTop: 14, marginBottom: 8, letterSpacing: 0.6 },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard:        { flexBasis: '47%', flexGrow: 1 },
  tableHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tableRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  colNum:          { width: 56, textAlign: 'right' },
  pillRow:         { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tabSwitch:       { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 8, padding: 2, marginBottom: 8, alignSelf: 'flex-start' },
  tab:             { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  tabActive:       { backgroundColor: colors.bg },
  quickAction:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  usageTrack:      { height: 6, backgroundColor: colors.bgInput, borderRadius: 3, overflow: 'hidden' },
  usageFill:       { height: 6, borderRadius: 3 },
  activityRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  activityDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 },
});
