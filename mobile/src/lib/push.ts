import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { meApi } from '@/api/me';

/**
 * Firebase Cloud Messaging registration.
 *
 * Lifecycle, driven by Supabase auth state:
 *   - On sign-in (and on cold start with an existing session) we request
 *     notification permission, fetch the FCM token, and POST it to
 *     /api/me/push-token so the server can target this device.
 *   - On token refresh we re-register the new token.
 *   - On sign-out we DELETE the token so the next user on this device doesn't
 *     receive the previous user's pushes.
 *
 * Foreground messages don't post a system notification on their own; we just
 * invalidate the notifications query so the in-app bell updates immediately.
 * Background/quit-state messages are shown by the OS (and, on Android, handled
 * by the background handler registered in index.js).
 */

const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Android 13+ (API 33) needs the runtime POST_NOTIFICATIONS grant.
      if (Number(Platform.Version) >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    if (__DEV__) console.warn('[push] permission request failed:', e);
    return false;
  }
}

export function usePushRegistration() {
  const qc = useQueryClient();
  // The token currently registered with the server, so we can unregister it.
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function register() {
      const granted = await requestPermission();
      if (!granted || !mounted) return;
      try {
        const token = await messaging().getToken();
        if (!token || !mounted) return;
        await meApi.registerPushToken(token, platform);
        registeredToken.current = token;
        if (__DEV__) console.log('[push] registered token');
      } catch (e) {
        if (__DEV__) console.warn('[push] getToken/register failed:', e);
      }
    }

    async function unregister() {
      const token = registeredToken.current;
      registeredToken.current = null;
      if (!token) return;
      try {
        await meApi.unregisterPushToken(token);
      } catch (e) {
        if (__DEV__) console.warn('[push] unregister failed:', e);
      }
    }

    // Register now if already signed in (cold start).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) register();
    });

    // React to future auth transitions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) register();
      else if (event === 'SIGNED_OUT') unregister();
    });

    // Re-register on FCM token rotation.
    const unsubRefresh = messaging().onTokenRefresh((token) => {
      meApi
        .registerPushToken(token, platform)
        .then(() => { registeredToken.current = token; })
        .catch((e) => { if (__DEV__) console.warn('[push] refresh register failed:', e); });
    });

    // Foreground messages — refresh the bell rather than showing a banner.
    const unsubMessage = messaging().onMessage(async () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    // Tapping a notification that opened the app — refresh in-app state.
    const unsubOpened = messaging().onNotificationOpenedApp(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubRefresh();
      unsubMessage();
      unsubOpened();
    };
  }, [qc]);
}
