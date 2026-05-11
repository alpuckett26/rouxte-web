import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { api } from '@/api/client';
import { colors } from '@/lib/colors';
import { ActivityIndicator, View } from 'react-native';
import PromoScreen from '@/screens/onboarding/PromoScreen';
import ProfileScreen from '@/screens/onboarding/ProfileScreen';
import DocumentsScreen from '@/screens/onboarding/DocumentsScreen';
import type { OnboardingStackParamList } from '@/types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface OnboardingStatus {
  step: 'promo' | 'profile' | 'documents' | 'complete';
}

export default function OnboardingNavigator() {
  const q = useQuery({
    queryKey: ['onboarding-status'],
    queryFn:  () => api.get<OnboardingStatus>('/api/onboarding/status'),
  });

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const initial: keyof OnboardingStackParamList =
    q.data?.step === 'documents' ? 'Documents' :
    q.data?.step === 'profile'   ? 'Profile' :
    'Promo';

  return (
    <Stack.Navigator
      initialRouteName={initial}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Promo"     component={PromoScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="Profile"   component={ProfileScreen}   options={{ title: 'Your profile' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
    </Stack.Navigator>
  );
}
