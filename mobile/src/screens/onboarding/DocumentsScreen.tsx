import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Screen, Text, Button, Card } from '@/components/ui';

export default function DocumentsScreen() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function skip() {
    setBusy(true);
    try {
      await api.post('/api/onboarding/complete-step', { step: 'documents' });
      qc.invalidateQueries({ queryKey: ['onboarding-status'] });
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>Documents</Text>
      <Text tone="dim" style={{ marginBottom: 18 }}>
        Your manager will list required documents (W-9, ID, agreements) here. Document upload is
        coming to mobile soon — please complete this step on the web for now.
      </Text>

      <Card>
        <Text variant="caption" tone="dim">REQUIRED ON THE WEB</Text>
        <Text style={{ marginTop: 6 }}>• Signed W-9</Text>
        <Text>• Government-issued ID</Text>
        <Text>• Rep agreement</Text>
      </Card>

      <View style={{ marginTop: 24, gap: 10 }}>
        <Button title="Continue to dashboard" onPress={skip} loading={busy} />
      </View>
    </Screen>
  );
}
