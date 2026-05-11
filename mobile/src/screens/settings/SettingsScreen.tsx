import React, { useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { meApi } from '@/api/me';
import { compensationApi } from '@/api/compensation';
import { api } from '@/api/client';
import { Screen, Text, Button, Card, Input, Badge } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { signOut, user } = useAuth();
  const { profile, isLoading, error, refetch } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  // Phone editor — fetch + edit
  const phoneQ = useQuery({ queryKey: ['me-phone'], queryFn: () => api.get<{ phone: string | null }>('/api/me/phone') });
  const [phone, setPhone] = useState('');
  useEffect(() => {
    if (phoneQ.data?.phone !== undefined) setPhone(phoneQ.data.phone ?? '');
  }, [phoneQ.data?.phone]);

  const phoneMutation = useMutation({
    mutationFn: () => meApi.updatePhone(phone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me-phone'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('Saved', 'Your phone number was updated.');
    },
    onError: (e: Error) => Alert.alert('Save failed', e.message),
  });

  // Compensation — only fetch if reps/team_lead (managers don't get commission pct typically)
  const compQ = useQuery({
    queryKey: ['compensation-me'],
    queryFn:  compensationApi.me,
    enabled:  profile?.role === 'sales_rep' || profile?.role === 'team_lead',
  });

  function confirmSignOut() {
    Alert.alert('Sign out?', "You'll need to enter your password again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try { await signOut(); } finally { setSigningOut(false); }
        },
      },
    ]);
  }

  const displayName = profile?.full_name || profile?.email || user?.email || 'Signed in';
  const displayEmail = profile?.email ?? user?.email ?? '';
  const roleLabel = profile?.role?.replace(/_/g, ' ');
  const orgLabel = profile?.org_name;

  return (
    <Screen
      refreshing={isLoading}
      onRefresh={() => { refetch(); phoneQ.refetch(); compQ.refetch(); }}
    >
      <Text variant="title" weight="bold">Settings</Text>

      {/* Identity */}
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

      {/* Phone */}
      <Text variant="caption" tone="dim" style={styles.section}>CONTACT</Text>
      <Card>
        <Input
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="555-123-4567"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <Button
          title={phoneMutation.isPending ? 'Saving…' : 'Save phone'}
          onPress={() => phoneMutation.mutate()}
          loading={phoneMutation.isPending}
          disabled={phone === (phoneQ.data?.phone ?? '')}
        />
      </Card>

      {/* Compensation (reps + team_leads) */}
      {(profile?.role === 'sales_rep' || profile?.role === 'team_lead') && (
        <>
          <Text variant="caption" tone="dim" style={styles.section}>COMPENSATION</Text>
          <Card>
            {compQ.isLoading ? (
              <Text tone="dim">Loading…</Text>
            ) : !compQ.data?.tier ? (
              <Text tone="dim">No commission tier assigned yet.</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text variant="caption" tone="dim">TIER</Text>
                    <Text weight="semibold" style={{ marginTop: 4 }}>{compQ.data.tier.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="caption" tone="dim">COMMISSION</Text>
                    <Text variant="display" weight="bold" tone="brand">{(compQ.data.tier.commission_pct * 100).toFixed(0)}%</Text>
                  </View>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Badge
                    label={`Standing: ${compQ.data.standing.replace('_', ' ')}`}
                    color={compQ.data.standing === 'terminated' ? 'red' : compQ.data.standing === 'at_risk' ? 'orange' : 'green'}
                    dot
                  />
                </View>
              </>
            )}
          </Card>
        </>
      )}

      {/* Sign out */}
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

const styles = StyleSheet.create({
  section: { marginTop: 14, marginBottom: 8, letterSpacing: 0.6 },
});
