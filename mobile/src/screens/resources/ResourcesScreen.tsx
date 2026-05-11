import React from 'react';
import { Screen, Text, Card } from '@/components/ui';

export default function ResourcesScreen() {
  return (
    <Screen>
      <Text variant="title" weight="bold">Resource Library</Text>
      <Card style={{ marginTop: 16 }}>
        <Text tone="dim">Promo sheets, forms, and shared documents will appear here.</Text>
        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>
          Upload + browse coming in the next mobile release. Manage uploads on the web for now.
        </Text>
      </Card>
    </Screen>
  );
}
