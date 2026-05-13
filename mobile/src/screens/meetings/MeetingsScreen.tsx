import React, { useState } from 'react';
import { View, StyleSheet, Linking, Alert, ScrollView, Pressable } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, type Meeting } from '@/api/meetings';
import { Screen, Text, Card, Button, Badge, Skeleton, ErrorBanner } from '@/components/ui';
import { colors } from '@/lib/colors';

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function MeetingsScreen() {
  const qc = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ['meetings'],
    queryFn:  meetingsApi.list,
    staleTime: 30_000,
  });

  const createInstant = useMutation({
    mutationFn: () => meetingsApi.create('Quick meeting', 'instant'),
    onMutate:   () => setCreating(true),
    onSettled:  () => setCreating(false),
    onSuccess:  async (res) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      await join(res.data.id);
    },
    onError: (e: Error) => Alert.alert('Could not create meeting', e.message),
  });

  async function join(id: string) {
    setJoiningId(id);
    try {
      const { token, room_url } = await meetingsApi.joinToken(id);
      // Daily Prebuilt accepts the meeting token as ?t=<jwt>, then handles
      // camera/mic prompts and the call UI itself.
      const sep = room_url.includes('?') ? '&' : '?';
      const joinUrl = `${room_url}${sep}t=${encodeURIComponent(token)}`;
      const ok = await Linking.canOpenURL(joinUrl);
      if (!ok) {
        Alert.alert('Cannot open meeting', 'No browser available to open the meeting link.');
        return;
      }
      await Linking.openURL(joinUrl);
    } catch (e) {
      Alert.alert('Could not join meeting', (e as Error).message);
    } finally {
      setJoiningId(null);
    }
  }

  const active = q.data?.data?.active ?? [];
  const recent = q.data?.data?.recent ?? [];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="title" weight="bold">Meetings</Text>
          <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>
            In-app video powered by Daily.co. Opens in your browser.
          </Text>
        </View>
        <Button
          title={creating ? 'Starting…' : 'Start now'}
          onPress={() => createInstant.mutate()}
          loading={creating}
          fullWidth={false}
        />
      </View>

      {q.error && <ErrorBanner error={q.error} context="meetings" />}

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text variant="caption" tone="dim" style={styles.section}>UPCOMING / LIVE</Text>
        {q.isLoading ? (
          <Skeleton height={70} borderRadius={12} />
        ) : active.length === 0 ? (
          <Card>
            <Text tone="dim">No active meetings. Tap "Start now" to spin one up.</Text>
          </Card>
        ) : (
          active.map((m) => (
            <Row key={m.id} meeting={m} joining={joiningId === m.id} onJoin={() => join(m.id)} />
          ))
        )}

        {recent.length > 0 && (
          <>
            <Text variant="caption" tone="dim" style={styles.section}>RECENT</Text>
            {recent.map((m) => (
              <Row key={m.id} meeting={m} joining={false} onJoin={() => { /* ended */ }} ended />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Row({ meeting, joining, onJoin, ended }: {
  meeting: Meeting; joining: boolean; onJoin: () => void; ended?: boolean;
}) {
  return (
    <Card style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text weight="semibold" numberOfLines={1}>{meeting.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Badge
              label={meeting.status === 'live' ? '● LIVE' : meeting.status === 'waiting' ? 'Waiting' : 'Ended'}
              color={meeting.status === 'live' ? 'green' : meeting.status === 'waiting' ? 'blue' : 'gray'}
            />
            <Text variant="caption" tone="dim">
              {meeting.scheduled_at ? fmtTime(meeting.scheduled_at) : fmtTime(meeting.created_at)}
            </Text>
          </View>
        </View>
        {!ended && (
          <Pressable onPress={onJoin} disabled={joining}>
            <Badge label={joining ? '…' : 'Join'} color="green" />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14, marginBottom: 6, letterSpacing: 0.6 },
});
