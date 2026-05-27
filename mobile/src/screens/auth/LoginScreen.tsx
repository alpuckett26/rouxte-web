import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import { useAuth } from '@/hooks/useAuth';
import { Screen, Text, Button, Input } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
type OAuthProvider = 'google' | 'github';

export default function LoginScreen({ navigation }: Props) {
  const { signIn, signInWithOAuth, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [appleBusy, setAppleBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    const err = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (err) setError(err.message);
  }

  async function onOAuth(provider: OAuthProvider) {
    setError(null);
    setOauthBusy(provider);
    const err = await signInWithOAuth(provider);
    if (err) {
      setError(err.message);
      setOauthBusy(null);
    }
    // If no error, the browser opens; user comes back via deep link.
    // Reset busy state in 30s in case they cancel.
    setTimeout(() => setOauthBusy(null), 30_000);
  }

  async function onApple() {
    setError(null);
    setAppleBusy(true);
    const err = await signInWithApple();
    setAppleBusy(false);
    // User-canceled errors from the Apple sheet shouldn't show as an error.
    if (err && !/cancel/i.test(err.message)) setError(err.message);
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="display" weight="bold" style={styles.brand}>Rouxte</Text>
        <Text variant="body" tone="dim" style={styles.sub}>Sign in to continue</Text>

        {/* OAuth buttons */}
        {Platform.OS === 'ios' && (
          appleBusy ? (
            <View style={[styles.oauthBtn, { backgroundColor: '#000' }]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <AppleButton
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.SIGN_IN}
              cornerRadius={10}
              style={styles.appleBtn}
              onPress={onApple}
            />
          )
        )}
        <Pressable
          onPress={() => onOAuth('google')}
          disabled={!!oauthBusy || busy || appleBusy}
          style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.7 }, !!oauthBusy && { opacity: 0.5 }]}
        >
          {oauthBusy === 'google' ? <ActivityIndicator color={colors.text} /> : (
            <Text weight="medium">Continue with Google</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => onOAuth('github')}
          disabled={!!oauthBusy || busy || appleBusy}
          style={({ pressed }) => [styles.oauthBtn, pressed && { opacity: 0.7 }, !!oauthBusy && { opacity: 0.5 }]}
        >
          {oauthBusy === 'github' ? <ActivityIndicator color={colors.text} /> : (
            <Text weight="medium">Continue with GitHub</Text>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text variant="caption" tone="mute" style={{ marginHorizontal: 10 }}>or</Text>
          <View style={styles.dividerLine} />
        </View>

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

        <Button title="Sign in" onPress={onSubmit} loading={busy} disabled={!email || !password || !!oauthBusy} />

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
          <Text variant="caption" tone="brand">Forgot password?</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center:       { paddingVertical: 60 },
  brand:        { textAlign: 'center', color: colors.brand, marginBottom: 4 },
  sub:          { textAlign: 'center', marginBottom: 36 },
  oauthBtn:     {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 50,
  },
  appleBtn:     { width: '100%', height: 50, marginBottom: 10 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  forgot:       { alignSelf: 'center', marginTop: 18 },
});
