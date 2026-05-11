import React from 'react';
import { Linking } from 'react-native';
import { Screen, Text, Card, Button } from '@/components/ui';
import { config } from '@/lib/config';

export default function PayrollScreen() {
  return (
    <Screen>
      <Text variant="title" weight="bold">Payroll</Text>
      <Card style={{ marginTop: 16 }}>
        <Text tone="dim">
          Pay periods, stubs, and compensation rules. Native payroll coming in Phase 5 of mobile.
        </Text>
      </Card>
      <Button
        title="Open payroll on web"
        onPress={() => Linking.openURL(`${config.api.baseUrl}/payroll`)}
        style={{ marginTop: 18 }}
        variant="secondary"
      />
    </Screen>
  );
}
