import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { Screen, Text, Card, Button } from '@/components/ui';
import { View } from 'react-native';

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });

  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = q.data?.notifications ?? [];
  const unread = q.data?.unread_count ?? 0;

  return (
    <Screen
      loading={q.isLoading}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text variant="title" weight="bold">Notifications</Text>
        {unread > 0 && <Button title="Mark all read" onPress={() => readAll.mutate()} variant="ghost" fullWidth={false} />}
      </View>

      {notifications.map((n) => (
        <Card key={n.id} style={{ marginBottom: 8, opacity: n.read_at ? 0.7 : 1 }}>
          <Text variant="caption" tone="dim">{new Date(n.created_at).toLocaleString()}</Text>
          <Text weight="semibold" style={{ marginTop: 2 }}>{n.title}</Text>
          {n.body && <Text tone="dim" style={{ marginTop: 4 }}>{n.body}</Text>}
          {!n.read_at && <Text tone="brand" variant="caption" weight="semibold" style={{ marginTop: 4 }}>● NEW</Text>}
        </Card>
      ))}
      {notifications.length === 0 && !q.isLoading && (
        <Text tone="mute" style={{ textAlign: 'center', marginTop: 36 }}>You're all caught up.</Text>
      )}
    </Screen>
  );
}
