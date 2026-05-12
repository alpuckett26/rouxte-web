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
import RootNavigator from '@/navigation';

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

/**
 * Catch OAuth callbacks (rouxteapp://auth-callback?code=...) and exchange
 * the code for a Supabase session. Runs both on cold start and while the
 * app is already running.
 */
function useOAuthDeepLink() {
  useEffect(() => {
    async function handleUrl(url: string) {
      if (!url.startsWith('rouxteapp://auth-callback')) return;
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch (e) {
        if (__DEV__) console.warn('[oauth] exchange failed:', e);
      }
    }

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
}

function App() {
  useOAuthDeepLink();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
        <QueryProvider>
          <IdleTimeout>
            <RootNavigator />
          </IdleTimeout>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default config.sentry.dsn ? Sentry.wrap(App) : App;
