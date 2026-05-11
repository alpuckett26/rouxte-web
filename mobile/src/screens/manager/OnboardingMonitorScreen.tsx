import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { onboardingMonitorApi, type MemberOnboarding } from '@/api/onboardingMonitor';
import { Screen, Text, Card, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

const STEP_LABEL: Record<MemberOnboarding['onboarding_step'], string> = {
  verify:    'Email Verify',
  promo:     'Promo Code',
  profile:   'Profile',
  documents: 'Documents',
  complete:  'Complete',
};

export default function OnboardingMonitorScreen() {
  const q = useQuery({ queryKey: ['onboarding-monitor'], queryFn: onboardingMonitorApi.list });
  const members = q.data?.data ?? [];

  const incomplete = members.filter((m) => !m.onboarding_complete);
  const complete = members.filter((m) => m.onboarding_complete);

  return (
    <Screen scrollable={false}>
      <Text variant="title" weight="bold">Onboarding</Text>
      <Text variant="caption" tone="dim">
        {incomplete.length} of {members.length} still working through setup
      </Text>

      {q.isLoading ? (
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={64} borderRadius={10} style={{ marginBottom: 6 }} />)}
        </View>
      ) : members.length === 0 ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}><Text tone="dim">No members yet.</Text></Card>
      ) : (
        <FlatList
          data={[...incomplete, ...complete]}
          keyExtractor={(m) => m.user_id}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 24 }}
          renderItem={({ item }) => <MemberRow member={item} />}
        />
      )}
    </Screen>
  );
}

function MemberRow({ member }: { member: MemberOnboarding }) {
  const stepColor: 'green' | 'yellow' | 'red' | 'gray' =
    member.onboarding_complete ? 'green' :
    member.onboarding_step === 'documents' ? 'yellow' :
    member.onboarding_step === 'verify' ? 'red' :
    'gray';

  const docsPct = member.docs_required > 0 ? (member.docs_submitted / member.docs_required) * 100 : 100;

  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text weight="semibold">{member.full_name}</Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>{member.role.replace('_', ' ')}</Text>
        </View>
        <Badge label={STEP_LABEL[member.onboarding_step]} color={stepColor} dot />
      </View>

      {member.docs_required > 0 && (
        <View style={{ marginTop: 8 }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, docsPct)}%`, backgroundColor: docsPct >= 100 ? colors.success : colors.warning }]} />
          </View>
          <Text variant="caption" tone="mute" style={{ marginTop: 4 }}>
            Documents {member.docs_submitted} / {member.docs_required}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, backgroundColor: colors.bgInput, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: 6 },
});
