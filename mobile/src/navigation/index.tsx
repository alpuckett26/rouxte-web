import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import { api } from '@/api/client';
import { ApiError } from '@/api/client';
import { colors } from '@/lib/colors';
import { useAuth } from '@/hooks/useAuth';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface OnboardingStatus {
  step: 'promo' | 'profile' | 'documents' | 'complete';
}

function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const onboarding = useQuery({
    queryKey: ['onboarding-status'],
    queryFn:  () => api.get<OnboardingStatus>('/api/onboarding/status'),
    enabled:  !!session,
    retry:    (count, err) => count < 1 && !(err instanceof ApiError && err.status === 401),
  });

  if (loading || (session && onboarding.isLoading)) {
    return <LoadingView />;
  }

  const screen: keyof RootStackParamList = !session
    ? 'Auth'
    : onboarding.data?.step && onboarding.data.step !== 'complete'
    ? 'Onboarding'
    : 'Main';

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
        <Stack.Screen name="Auth"       component={AuthNavigator} />
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        <Stack.Screen name="Main"       component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
