import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Screen, Text, Button, Card } from '@/components/ui';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { profile } = useProfile();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You\'ll need to enter your password again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <Text variant="title" weight="bold">Settings</Text>

      <Card style={{ marginTop: 18 }}>
        <Text variant="caption" tone="dim">SIGNED IN AS</Text>
        <Text weight="semibold" style={{ marginTop: 4 }}>{profile?.full_name ?? 'Loading…'}</Text>
        <Text tone="dim" variant="caption">{profile?.email ?? ''}</Text>
        <Text tone="dim" variant="caption" style={{ marginTop: 6 }}>
          {profile?.role?.replace(/_/g, ' ')} · {profile?.org_name ?? ''}
        </Text>
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button title="Sign out" onPress={confirmSignOut} variant="danger" />
      </View>

      <Text tone="mute" variant="caption" style={{ textAlign: 'center', marginTop: 40 }}>
        Rouxte Mobile · v0.0.1
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({});
