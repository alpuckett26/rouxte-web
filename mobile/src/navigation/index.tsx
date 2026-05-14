import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/lib/colors';
import { useAuth } from '@/hooks/useAuth';
import { BillingGate } from '@/components/BillingGate';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

function GatedMain() {
  return (
    <BillingGate>
      <MainNavigator />
    </BillingGate>
  );
}

const Stack = createNativeStackNavigator();

function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const navTheme = {
  dark: true,
  colors: {
    primary: colors.brand,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.brand,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium:  { fontFamily: 'System', fontWeight: '500' as const },
    bold:    { fontFamily: 'System', fontWeight: '700' as const },
    heavy:   { fontFamily: 'System', fontWeight: '900' as const },
  },
};

/**
 * Root navigator. Conditionally renders the entire stack contents based
 * on session — this is the React Navigation-recommended pattern for auth
 * gating because changing screens within one Stack.Navigator doesn't
 * reliably unmount the old screens (internal navigator state persists
 * across `key` changes).
 *
 * Onboarding gate is intentionally not here — mobile assumes users
 * complete onboarding on the web. If a user logs in without finishing
 * it, /api/me returns a profile with null org_id and Settings shows
 * a warning.
 */
export default function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingView />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Main" component={GatedMain} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
