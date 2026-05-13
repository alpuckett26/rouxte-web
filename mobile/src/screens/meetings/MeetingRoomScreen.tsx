import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useQuery } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { meetingsApi } from '@/api/meetings';
import { Screen, Text, Skeleton, ErrorBanner, Button } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'MeetingRoom'>;

export default function MeetingRoomScreen({ route, navigation }: Props) {
  const { id, title } = route.params;
  const webRef = useRef<WebView>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: title || 'Meeting' });
  }, [navigation, title]);

  const q = useQuery({
    queryKey: ['meeting-join-token', id],
    queryFn:  () => meetingsApi.joinToken(id),
    staleTime: 0,
    gcTime: 0,
  });

  const joinUrl = useMemo(() => {
    if (!q.data) return null;
    const { token, room_url } = q.data;
    const sep = room_url.includes('?') ? '&' : '?';
    return `${room_url}${sep}t=${encodeURIComponent(token)}`;
  }, [q.data]);

  // Hardware back on Android: confirm before leaving an in-progress call.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Leave meeting?', 'Your call will end on this device.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={240} borderRadius={12} />
        <Text tone="dim" style={{ marginTop: 12 }}>Connecting to meeting…</Text>
      </Screen>
    );
  }

  if (q.error || !joinUrl) {
    return (
      <Screen>
        <ErrorBanner error={q.error ?? new Error('No meeting URL')} context="meeting" />
        <Button title="Back" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: joinUrl }}
        style={styles.web}
        // Daily Prebuilt is a single-page app — inline media + no user-gesture
        // requirement let getUserMedia run immediately.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['https://*']}
        allowsBackForwardNavigationGestures={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <Text tone="dim">Loading meeting…</Text>
          </View>
        )}
        onError={(e) => {
          Alert.alert('Meeting error', e.nativeEvent.description || 'Could not load the room.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  web:  { flex: 1, backgroundColor: '#000' },
  loader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});

export type MeetingRoomRoute = RouteProp<MoreStackParamList, 'MeetingRoom'>;
