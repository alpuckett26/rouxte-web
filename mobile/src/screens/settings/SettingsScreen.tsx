import React, { useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { meApi } from '@/api/me';
import { accountApi } from '@/api/account';
import { compensationApi } from '@/api/compensation';
import { api, apiBaseUrl, ApiError } from '@/api/client';
import { getAccessToken } from '@/lib/supabase';
import { Screen, Text, Button, Card, Input, Badge, ErrorBanner } from '@/components/ui';
import { colors } from '@/lib/colors';

export default function SettingsScreen() {
  const qc = useQueryClient();
  const { signOut, user } = useAuth();
  const { profile, isLoading, error: profileError, refetch } = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [debug, setDebug] = useState<string | null>(null);

  const phoneQ = useQuery({
    queryKey: ['me-phone'],
    queryFn:  () => api.get<{ phone: string | null }>('/api/me/phone'),
    retry:    false,
  });
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

  const compQ = useQuery({
    queryKey: ['compensation-me'],
    queryFn:  compensationApi.me,
    enabled:  profile?.role === 'sales_rep' || profile?.role === 'team_lead',
    retry:    false,
  });

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      // session change is handled by useAuth listener which clears state + navigates
    } catch (e) {
      setSignOutError((e as Error).message);
    } finally {
      setSigningOut(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', "You'll need to enter your password again.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await accountApi.delete();
      // Account is anonymized + login revoked server-side; clear the local
      // session. The useAuth listener handles navigation back to sign-in.
      await signOut();
    } catch (e) {
      setDeleting(false);
      Alert.alert('Deletion failed', (e as Error).message);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your name, photo, phone, email, and sign-in. ' +
        'You will not be able to log back in. Records we are legally required to ' +
        'keep (commission/tax, compliance logs) are retained with your personal ' +
        'identifiers removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This action is permanent.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: handleDeleteAccount },
            ]),
        },
      ],
    );
  }

  async function dumpDebug() {
    const token = await getAccessToken();
    let meStatus: number | string = '?';
    let meBody: unknown = null;
    try {
      meBody = await api.get('/api/me');
      meStatus = 200;
    } catch (e) {
      if (e instanceof ApiError) {
        meStatus = e.status;
        meBody = e.body;
      } else {
        meStatus = 'network';
        meBody = (e as Error).message;
      }
    }
    setDebug(JSON.stringify({
      apiBaseUrl,
      hasToken: !!token,
      tokenPrefix: token?.slice(0, 16) ?? null,
      authUserId: user?.id ?? null,
      authEmail: user?.email ?? null,
      meStatus,
      meBody,
    }, null, 2));
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

      {profileError && (
        <ErrorBanner error={profileError} context="profile" onRetry={() => refetch()} />
      )}

      {/* Identity */}
      <Card style={{ marginTop: 14 }}>
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
            {profile && !profile.org_id && (
              <Text tone="warning" variant="caption" style={{ marginTop: 8 }}>
                Onboarding not complete. Finish setup on the web.
              </Text>
            )}
          </>
        )}
      </Card>

      {/* Phone */}
      <Text variant="caption" tone="dim" style={styles.section}>CONTACT</Text>
      <Card>
        {phoneQ.error && <ErrorBanner error={phoneQ.error} context="phone" onRetry={() => phoneQ.refetch()} />}
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
            {compQ.error ? (
              <ErrorBanner error={compQ.error} context="compensation" onRetry={() => compQ.refetch()} />
            ) : compQ.isLoading ? (
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
        {signOutError && <ErrorBanner error={new Error(signOutError)} context="sign out" />}
        <Button title="Sign out" onPress={confirmSignOut} variant="danger" loading={signingOut} />
      </View>

      {/* Delete account */}
      <Text variant="caption" tone="dim" style={styles.section}>ACCOUNT</Text>
      <Card>
        <Text variant="caption" tone="mute" style={{ marginBottom: 8 }}>
          Permanently delete your account and personal information. Records we are
          legally required to keep are retained de-identified. This cannot be undone.
        </Text>
        <Button
          title={deleting ? 'Deleting…' : 'Delete account'}
          onPress={confirmDeleteAccount}
          variant="danger"
          loading={deleting}
        />
      </Card>

      {/* Debug */}
      <Text variant="caption" tone="dim" style={styles.section}>DEBUG</Text>
      <Card>
        <Text variant="caption" tone="mute" style={{ marginBottom: 8 }}>
          Use when something says "no data" or 404. Dumps the API base URL,
          your token state, and the raw /api/me response — paste back to debug.
        </Text>
        <Button title="Dump session + ping /api/me" onPress={dumpDebug} variant="secondary" />
        {debug && (
          <ScrollView style={styles.debugBox}>
            <Text variant="mono" tone="dim" selectable>{debug}</Text>
          </ScrollView>
        )}
      </Card>

      <Text tone="mute" variant="caption" style={{ textAlign: 'center', marginTop: 40 }}>
        Rouxte Mobile · v1.0.0
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section:  { marginTop: 14, marginBottom: 8, letterSpacing: 0.6 },
  debugBox: {
    marginTop: 8,
    maxHeight: 240,
    padding: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
