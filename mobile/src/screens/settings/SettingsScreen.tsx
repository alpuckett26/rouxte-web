import React, { useState } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Screen, Text, Button, Card } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const { profile, isLoading, error, refetch } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sign out?', "You'll need to enter your password again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  // Display value priority: full_name → email → loading state
  const displayName = profile?.full_name || profile?.email || user?.email || 'Signed in';
  const displayEmail = profile?.email ?? user?.email ?? '';
  const roleLabel = profile?.role?.replace(/_/g, ' ');
  const orgLabel = profile?.org_name;

  return (
    <Screen>
      <Text variant="title" weight="bold">Settings</Text>

      <Card style={{ marginTop: 18 }}>
        <Text variant="caption" tone="dim">SIGNED IN AS</Text>
        {isLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <ActivityIndicator color={colors.brand} />
            <Text tone="dim">Loading profile…</Text>
          </View>
        ) : (
          <>
            <Text weight="semibold" style={{ marginTop: 4 }}>{displayName}</Text>
            {displayEmail && displayEmail !== displayName && (
              <Text tone="dim" variant="caption">{displayEmail}</Text>
            )}
            {(roleLabel || orgLabel) && (
              <Text tone="dim" variant="caption" style={{ marginTop: 6 }}>
                {[roleLabel, orgLabel].filter(Boolean).join(' · ')}
              </Text>
            )}
            {!profile?.org_id && (
              <Text tone="warning" variant="caption" style={{ marginTop: 8 }}>
                Onboarding not complete. Finish setup on the web.
              </Text>
            )}
            {error && (
              <Text tone="danger" variant="caption" style={{ marginTop: 6 }}>
                Couldn't load profile. {(error as Error).message}
              </Text>
            )}
          </>
        )}
      </Card>

      <View style={{ marginTop: 24, gap: 8 }}>
        {error && <Button title="Retry profile load" onPress={() => refetch()} variant="secondary" />}
        <Button title="Sign out" onPress={confirmSignOut} variant="danger" loading={signingOut} />
      </View>

      <Text tone="mute" variant="caption" style={{ textAlign: 'center', marginTop: 40 }}>
        Rouxte Mobile · v0.0.1
      </Text>
    </Screen>
  );
}
