import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { config } from '@/lib/config';
import { QueryProvider } from '@/providers/QueryProvider';
import { IdleTimeout } from '@/components/IdleTimeout';
import RootNavigator from '@/navigation';

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

function App() {
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
