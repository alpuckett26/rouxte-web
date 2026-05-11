import React from 'react';
import { View, StyleSheet, Share, Alert, Image } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { smartpitchApi, type FunnelSubmission } from '@/api/smartpitch';
import { Screen, Text, Card, Button, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';
import { config } from '@/lib/config';

export default function SmartPitchScreen() {
  const q = useQuery({ queryKey: ['smartpitch-me'], queryFn: smartpitchApi.me });

  const create = useMutation({
    mutationFn: smartpitchApi.create,
    onSuccess: () => q.refetch(),
    onError: (e: Error) => Alert.alert('Could not create funnel', e.message),
  });

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={140} borderRadius={12} />
      </Screen>
    );
  }

  // No funnel — show enable CTA
  if (!q.data?.funnel) {
    return (
      <Screen>
        <Text variant="title" weight="bold">SmartPitch</Text>
        <Card style={{ marginTop: 16 }}>
          <Text tone="dim">
            A public landing page you share with prospects. They answer a few questions, you get
            a scored, ranked lead in real time.
          </Text>
          <Button title="Create my funnel" onPress={() => create.mutate()} loading={create.isPending} style={{ marginTop: 12 }} />
        </Card>
      </Screen>
    );
  }

  const { funnel, stats, recent, qr_data_url } = q.data;
  const funnelUrl = q.data.funnel_url ?? `${config.api.baseUrl}/r/${funnel.slug}`;

  function share() {
    Share.share({ message: `Check out our internet plans: ${funnelUrl}` });
  }

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">SmartPitch</Text>
      <Text variant="caption" tone="dim">{funnel.funnel_name}</Text>

      {/* Funnel link card */}
      <Card style={{ marginTop: 16, alignItems: 'center' }}>
        {qr_data_url && <Image source={{ uri: qr_data_url }} style={styles.qr} />}
        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>YOUR LINK</Text>
        <Text tone="brand" weight="medium" style={{ marginTop: 2 }} numberOfLines={1}>{funnelUrl}</Text>
        <Button title="Share link" onPress={share} style={{ marginTop: 12 }} />
      </Card>

      {/* Stats */}
      {stats && (
        <View style={styles.grid}>
          <Stat label="Total" value={stats.total}                          />
          <Stat label="Hot"   value={stats.hot}  color="red"  />
          <Stat label="Warm"  value={stats.warm} color="orange" />
          <Stat label="Cold"  value={stats.cold} color="gray" />
        </View>
      )}

      <Text variant="caption" tone="dim" style={styles.section}>RECENT SUBMISSIONS</Text>
      {recent.length === 0 ? (
        <Card style={{ alignItems: 'center' }}>
          <Text tone="dim">No submissions yet — share your link!</Text>
        </Card>
      ) : (
        recent.map((sub) => <SubmissionRow key={sub.id} sub={sub} />)
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: 'red' | 'orange' | 'gray' }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" tone="dim">{label.toUpperCase()}</Text>
      <Text variant="title" weight="bold" tone={color === 'red' ? 'danger' : color === 'orange' ? 'warning' : 'default'}>
        {value}
      </Text>
    </Card>
  );
}

function SubmissionRow({ sub }: { sub: FunnelSubmission }) {
  const tempColor =
    sub.lead_temperature === 'hot'  ? 'red' :
    sub.lead_temperature === 'warm' ? 'orange' :
    'gray';
  return (
    <Card style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text weight="semibold">{sub.customer_name ?? 'Anonymous'}</Text>
            {sub.lead_temperature && <Badge label={sub.lead_temperature.toUpperCase()} color={tempColor as never} dot />}
          </View>
          {sub.phone && <Text variant="caption" tone="dim">{sub.phone}</Text>}
          {sub.service_interest && <Text variant="caption" tone="mute" style={{ marginTop: 2 }}>Interest: {sub.service_interest}</Text>}
          {sub.current_provider && <Text variant="caption" tone="mute">Current: {sub.current_provider}</Text>}
          {sub.recommended_pitch && (
            <Text variant="caption" tone="brand" style={{ marginTop: 4, fontStyle: 'italic' }}>"{sub.recommended_pitch}"</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {sub.lead_score !== null && <Text variant="title" weight="bold" tone="brand">{sub.lead_score}</Text>}
          <Text variant="caption" tone="mute">{new Date(sub.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  qr:       { width: 160, height: 160, marginTop: 8, borderRadius: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statCard: { flexBasis: '47%', flexGrow: 1 },
  section:  { marginTop: 18, marginBottom: 8, letterSpacing: 0.6 },
});
