import React from 'react';
import { Linking } from 'react-native';
import { Screen, Text, Card, Button } from '@/components/ui';
import { config } from '@/lib/config';

export default function StoreScreen() {
  return (
    <Screen>
      <Text variant="title" weight="bold">Store</Text>
      <Card style={{ marginTop: 16 }}>
        <Text tone="dim">
          Custom badges, gear, and team swag. Checkout uses Square in-app payments — coming soon.
        </Text>
        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>
          For now, place orders on the web.
        </Text>
      </Card>
      <Button
        title="Open store on web"
        onPress={() => Linking.openURL(`${config.api.baseUrl}/store`)}
        style={{ marginTop: 18 }}
        variant="secondary"
      />
    </Screen>
  );
}
