import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Screen, Text, Button, Input } from '@/components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    Alert.alert('Check your email', 'We sent you a reset link.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text variant="title" weight="bold" style={styles.title}>Reset password</Text>
        <Text tone="dim" style={styles.sub}>
          Enter the email on your account. We'll send a link to set a new password.
        </Text>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={error}
        />
        <Button title="Send reset link" onPress={onSubmit} loading={busy} disabled={!email} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap:  { paddingTop: 24 },
  title: { marginBottom: 8 },
  sub:   { marginBottom: 24 },
});
