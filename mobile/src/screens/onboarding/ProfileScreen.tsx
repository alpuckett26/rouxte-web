import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { meApi } from '@/api/me';
import { Screen, Text, Input, Button } from '@/components/ui';

export default function ProfileScreen() {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (phone) await meApi.updatePhone(phone);
      await api.post('/api/onboarding/complete-step', { step: 'profile', full_name: fullName });
      qc.invalidateQueries({ queryKey: ['onboarding-status'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>Your profile</Text>
      <Text tone="dim" style={{ marginBottom: 18 }}>
        We'll show your name and phone to customers on shared quotes and digital cards.
      </Text>
      <Input label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Button title="Continue" onPress={submit} loading={busy} disabled={!fullName.trim()} />
    </Screen>
  );
}
