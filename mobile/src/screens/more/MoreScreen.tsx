import React from 'react';
import { useProfile, isManager, isFullManager } from '@/hooks/useProfile';
import { Screen, Text, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

interface RowProps { label: string; description?: string; onPress: () => void; }

function Row({ label, description, onPress }: RowProps) {
  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{label}</Text>
        {description && <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>{description}</Text>}
      </View>
      <Text tone="dim">›</Text>
    </Card>
  );
}

export default function MoreScreen({ navigation }: Props) {
  const { profile } = useProfile();
  const role = profile?.role;
  const showManager = isManager(role);
  const showFullManager = isFullManager(role);

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 16 }}>More</Text>

      <Text variant="caption" tone="dim" style={styles.section}>LEARN</Text>
      <Row label="Training" description="Modules + quizzes" onPress={() => navigation.navigate('Training')} />
      <Row label="AI Coach (Rex)" description="Ask & roleplay" onPress={() => navigation.navigate('Coach')} />
      <Row label="Leaderboard" description="Org-wide ranking" onPress={() => navigation.navigate('Leaderboard')} />

      <Text variant="caption" tone="dim" style={styles.section}>YOU</Text>
      <Row label="Goals" description="Your sales goal progress" onPress={() => navigation.navigate('Goals')} />
      <Row label="SmartPitch" description="Your shareable funnel" onPress={() => navigation.navigate('SmartPitch')} />
      <Row label="Notifications"     onPress={() => navigation.navigate('Notifications')} />
      <Row label="Digital card"      description="Shareable contact card" onPress={() => navigation.navigate('Card')} />
      <Row label="Resource library"  onPress={() => navigation.navigate('Resources')} />
      <Row label="Meetings"          description="In-app video" onPress={() => navigation.navigate('Meetings')} />
      <Row label="Store"             description="Gear + badges" onPress={() => navigation.navigate('Store')} />

      {showManager && (
        <>
          <Text variant="caption" tone="dim" style={styles.section}>MANAGE</Text>
          <Row label="Manager" description={showFullManager ? 'Queue, team, funnels' : 'Team view'} onPress={() => navigation.navigate('Manager')} />
          {showFullManager && <Row label="Payroll" description="Periods + stubs" onPress={() => navigation.navigate('Payroll')} />}
        </>
      )}

      <Text variant="caption" tone="dim" style={styles.section}>ACCOUNT</Text>
      <Row label="Settings" description="Profile + sign out" onPress={() => navigation.navigate('Settings')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 6, letterSpacing: 0.6 },
  row:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6, borderColor: colors.border },
});
