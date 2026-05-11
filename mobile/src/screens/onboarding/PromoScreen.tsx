import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { api } from '@/api/client';
import { Screen, Text, Button, Input } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';

export default function PromoScreen() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post('/api/onboarding/complete-step', { step: 'promo', invite_code: code || undefined });
      qc.invalidateQueries({ queryKey: ['onboarding-status'] });
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: 20 }}>
        <Text variant="title" weight="bold">Welcome to Rouxte</Text>
        <Text tone="dim" style={{ marginTop: 8 }}>
          If your manager gave you an invite code, enter it below. Otherwise tap Continue.
        </Text>
        <Input
          label="Invite code (optional)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button title="Continue" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
