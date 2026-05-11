import React from 'react';
import { Linking } from 'react-native';
import { useProfile, isFullManager } from '@/hooks/useProfile';
import { Screen, Text, Card, Button } from '@/components/ui';
import { config } from '@/lib/config';

export default function ManagerScreen() {
  const { profile } = useProfile();
  const isFull = isFullManager(profile?.role);

  return (
    <Screen>
      <Text variant="title" weight="bold">Manager</Text>
      <Text tone="dim" style={{ marginTop: 6 }}>
        {isFull
          ? 'Queue, team, funnels, compensation, payroll.'
          : 'Team-lead view: your team\'s leads and performance.'}
      </Text>

      <Card style={{ marginTop: 18 }}>
        <Text variant="caption" tone="dim">COMING TO MOBILE</Text>
        <Text style={{ marginTop: 6 }}>• Sales queue review</Text>
        <Text>• Team performance + assignments</Text>
        <Text>• SmartPitch funnel management</Text>
        {isFull && <Text>• Compensation rules + payroll</Text>}
        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>
          Full manager flows are still web-only. Native screens land in Phase 5 of the mobile build.
        </Text>
      </Card>

      <Button
        title="Open manager queue on web"
        onPress={() => Linking.openURL(`${config.api.baseUrl}/manager`)}
        style={{ marginTop: 18 }}
        variant="secondary"
      />
    </Screen>
  );
}
