import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Screen, Text, Button, Input } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    const err = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="display" weight="bold" style={styles.brand}>Rouxte</Text>
        <Text variant="body" tone="dim" style={styles.sub}>Sign in to continue</Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          placeholder="••••••••"
          error={error}
        />

        <Button title="Sign in" onPress={onSubmit} loading={busy} disabled={!email || !password} />

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
          <Text variant="caption" tone="brand">Forgot password?</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 60 },
  brand:  { textAlign: 'center', color: colors.brand, marginBottom: 4 },
  sub:    { textAlign: 'center', marginBottom: 36 },
  forgot: { alignSelf: 'center', marginTop: 18 },
});
