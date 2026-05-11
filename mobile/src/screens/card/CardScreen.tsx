import React from 'react';
import { Share, View, StyleSheet } from 'react-native';
import { useProfile } from '@/hooks/useProfile';
import { Screen, Text, Button, Card } from '@/components/ui';
import { config } from '@/lib/config';

export default function CardScreen() {
  const { profile } = useProfile();
  const link = profile?.user_id ? `${config.api.baseUrl}/card/${profile.user_id}` : '';

  return (
    <Screen>
      <Text variant="title" weight="bold">Digital Card</Text>
      <Text tone="dim" style={{ marginTop: 6 }}>
        Share this card so customers can save your contact info.
      </Text>

      <Card style={styles.preview}>
        <Text variant="caption" tone="dim">CARD PREVIEW</Text>
        <Text variant="heading" weight="bold" style={{ marginTop: 6 }}>{profile?.full_name ?? '—'}</Text>
        <Text tone="dim">{profile?.role?.replace(/_/g, ' ')}</Text>
        <Text tone="dim" variant="caption" style={{ marginTop: 8 }}>{profile?.org_name}</Text>
        <Text tone="brand" variant="caption" style={{ marginTop: 8 }}>{link}</Text>
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button title="Share card link" onPress={() => Share.share({ message: link })} disabled={!link} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 18, padding: 18 },
});
