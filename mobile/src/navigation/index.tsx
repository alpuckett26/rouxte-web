import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/lib/colors';
import { useAuth } from '@/hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

/**
 * Root navigator. Web onboarding (the /onboarding/check flow) doesn't have a
 * simple JSON status endpoint — mobile assumes users complete onboarding on
 * the web. If a user logs in to mobile without finishing it, /api/me returns
 * a profile with null org_id and the Settings screen shows a warning.
 */
export default function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingView />;

  const screen: keyof RootStackParamList = session ? 'Main' : 'Auth';

  return (
    <NavigationContainer
      theme={{
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
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={screen} key={screen}>
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
