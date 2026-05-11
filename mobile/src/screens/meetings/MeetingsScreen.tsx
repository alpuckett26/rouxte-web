import React from 'react';
import { Linking } from 'react-native';
import { Screen, Text, Card, Button } from '@/components/ui';
import { config } from '@/lib/config';

export default function MeetingsScreen() {
  return (
    <Screen>
      <Text variant="title" weight="bold">Meetings</Text>
      <Card style={{ marginTop: 16 }}>
        <Text tone="dim">In-app video powered by Daily.co.</Text>
        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>
          Native Daily.co video coming in the next mobile release. Use the web meetings page for now.
        </Text>
      </Card>
      <Button
        title="Open meetings on web"
        onPress={() => Linking.openURL(`${config.api.baseUrl}/meetings`)}
        style={{ marginTop: 18 }}
        variant="secondary"
      />
    </Screen>
  );
}
