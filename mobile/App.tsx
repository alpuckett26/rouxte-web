import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { config } from '@/lib/config';
import { QueryProvider } from '@/providers/QueryProvider';
import { IdleTimeout } from '@/components/IdleTimeout';
import { supabase } from '@/lib/supabase';
import { usePushRegistration } from '@/lib/push';
import RootNavigator from '@/navigation';

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

/**
 * Catch OAuth callbacks (rouxteapp://auth-callback?code=... for PKCE, or
 * rouxteapp://auth-callback#access_token=...&refresh_token=... for implicit)
 * and convert them into a Supabase session. Handles both cold start
 * (Linking.getInitialURL) and warm app (Linking listener).
 */
function useOAuthDeepLink() {
  useEffect(() => {
    async function handleUrl(url: string) {
      if (!url.startsWith('rouxteapp://auth-callback')) return;
      if (__DEV__) console.log('[oauth] callback URL:', url);

      // Parse params from either ?query or #fragment.
      const queryIdx = url.indexOf('?');
      const hashIdx  = url.indexOf('#');
      const paramSegment =
        queryIdx >= 0 ? url.slice(queryIdx + 1)
        : hashIdx >= 0 ? url.slice(hashIdx + 1)
        : '';

      const params = new URLSearchParams(paramSegment);
      const code         = params.get('code');
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const errParam     = params.get('error') ?? params.get('error_description');

      if (errParam) {
        if (__DEV__) console.warn('[oauth] supabase returned error:', errParam);
        return;
      }

      try {
        if (code) {
          // PKCE — exchange the code for a session (uses verifier from storage).
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (__DEV__) console.log(
            '[oauth] exchangeCodeForSession:',
            error ? `ERROR ${error.message}` : `OK user=${data.session?.user.email}`,
          );
        } else if (accessToken && refreshToken) {
          // Implicit flow — tokens are already in the URL.
          const { data, error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (__DEV__) console.log(
            '[oauth] setSession:',
            error ? `ERROR ${error.message}` : `OK user=${data.session?.user.email}`,
          );
        } else if (__DEV__) {
          console.warn('[oauth] callback had no code or tokens:', paramSegment);
        }
      } catch (e) {
        if (__DEV__) console.warn('[oauth] exchange threw:', e);
      }
    }

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
}

/** Lives inside QueryProvider so push registration can touch the query cache. */
function AppContent() {
  usePushRegistration();
  return (
    <IdleTimeout>
      <RootNavigator />
    </IdleTimeout>
  );
}

function App() {
  useOAuthDeepLink();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
        <QueryProvider>
          <AppContent />
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default config.sentry.dsn ? Sentry.wrap(App) : App;
