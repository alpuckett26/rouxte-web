import React from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProfile, isFullManager } from '@/hooks/useProfile';
import { managerApi } from '@/api/manager';
import { dashboardApi } from '@/api/dashboard';
import { Screen, Text, Card, Button, Badge } from '@/components/ui';
import { colors } from '@/lib/colors';
import { config } from '@/lib/config';
import type { ManagerStackParamList } from '@/navigation/ManagerNavigator';

type Nav = NativeStackNavigationProp<ManagerStackParamList, 'ManagerHome'>;

export default function ManagerScreen() {
  const nav = useNavigation<Nav>();
  const { profile } = useProfile();
  const isFull = isFullManager(profile?.role);

  const queue = useQuery({ queryKey: ['sales-queue'], queryFn: managerApi.queue, enabled: isFull });
  const members = useQuery({ queryKey: ['org-members'], queryFn: managerApi.orgMembers, enabled: isFull });
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const pendingCount = queue.data?.pending?.length ?? 0;
  const memberCount = members.data?.data?.length ?? 0;
  const incidents = dash.data?.pending_incidents ?? 0;

  return (
    <Screen>
      <Text variant="title" weight="bold">Manager</Text>
      <Text variant="caption" tone="dim">
        {isFull ? 'Queue, team, payroll' : 'Team-lead view'}
      </Text>

      {/* Stats row */}
      <View style={styles.grid}>
        <StatTile
          label="Pending sales"
          value={pendingCount}
          tone="brand"
          onPress={() => nav.navigate('Queue')}
        />
        <StatTile
          label="Open incidents"
          value={incidents}
          tone={incidents > 0 ? 'danger' : 'default'}
        />
        <StatTile
          label="Org members"
          value={memberCount}
          onPress={() => nav.navigate('People')}
        />
      </View>

      <Text variant="caption" tone="dim" style={styles.section}>OPERATIONS</Text>
      <Card>
        <NavRow label="Sales Queue"  description={`${pendingCount} pending`} onPress={() => nav.navigate('Queue')} />
        <NavRow label="People"       description={`${memberCount} members`}  onPress={() => nav.navigate('People')} />
        <NavRow label="My Team"      description="Tier + per-member stats"   onPress={() => nav.navigate('Team')} />
        <NavRow label="Compliance"   description={`${incidents} pending`}    onPress={() => nav.navigate('Compliance')} />
        <NavRow label="Onboarding"   description="Track rep readiness"        onPress={() => nav.navigate('OnboardingMonitor')} />
      </Card>

      <Text variant="caption" tone="dim" style={styles.section}>ADMIN</Text>
      <Card>
        <NavRow label="Teams"           description="Create + view teams"        onPress={() => nav.navigate('Teams')} />
        <NavRow label="Compensation"    description="Commission tiers"           onPress={() => nav.navigate('Compensation')} />
        <NavRow label="Goals"           description="Sales targets per rep/team" onPress={() => nav.navigate('Goals')} />
        <NavRow label="Coach Knowledge" description="Q&A + competitor intel"     onPress={() => nav.navigate('Coach')} />
        <NavRow label="SmartPitch (org)" description="All rep funnels"           onPress={() => nav.navigate('SmartPitch')} />
        <NavRow label="Payroll Periods" description="Create + generate stubs"    onPress={() => nav.navigate('PayrollPeriods')} />
      </Card>

      <Text variant="caption" tone="dim" style={styles.section}>STILL ON WEB</Text>
      <Card>
        <ExternalRow label="Resource uploads"     url={`${config.api.baseUrl}/manager/resources`} />
        <ExternalRow label="BDC import / wizard"  url={`${config.api.baseUrl}/manager/import-bdc`} />
        <ExternalRow label="Store badge designer" url={`${config.api.baseUrl}/store/badge`} />
      </Card>

      <Text tone="mute" variant="caption" style={{ marginTop: 16, textAlign: 'center' }}>
        Web-only screens open in your browser. Native ports land in future updates.
      </Text>
    </Screen>
  );
}

function StatTile({ label, value, tone, onPress }: {
  label: string; value: number;
  tone?: 'brand' | 'danger' | 'default';
  onPress?: () => void;
}) {
  const Wrap: React.ComponentType<{ children: React.ReactNode; style: any }> = onPress
    ? ({ children, style }) => <Pressable onPress={onPress} style={style}>{children}</Pressable>
    : ({ children, style }) => <View style={style}>{children}</View>;
  return (
    <Wrap style={styles.tile}>
      <Card style={{ width: '100%' }}>
        <Text variant="caption" tone="dim">{label.toUpperCase()}</Text>
        <Text variant="display" weight="bold" tone={tone === 'default' ? undefined : tone}>{value}</Text>
        {onPress && <Text variant="caption" tone="brand" style={{ marginTop: 4 }}>Open →</Text>}
      </Card>
    </Wrap>
  );
}

function NavRow({ label, description, onPress }: { label: string; description?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{label}</Text>
        {description && <Text variant="caption" tone="dim">{description}</Text>}
      </View>
      <Text tone="dim">›</Text>
    </Pressable>
  );
}

function ExternalRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
      </View>
      <Text tone="brand" variant="caption">↗ Web</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile:     { flexBasis: '47%', flexGrow: 1 },
  section:  { marginTop: 16, marginBottom: 8, letterSpacing: 0.6 },
  navRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
