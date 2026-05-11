import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/lib/colors';
import LeadsScreen from '@/screens/leads/LeadsScreen';
import LeadDetailScreen from '@/screens/leads/LeadDetailScreen';
import NewLeadScreen from '@/screens/leads/NewLeadScreen';
import LeadPullScreen from '@/screens/leads/LeadPullScreen';
import type { LeadsStackParamList } from '@/types';

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export default function LeadsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="LeadsList"  component={LeadsScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Lead' }} />
      <Stack.Screen name="NewLead"    component={NewLeadScreen}    options={{ title: 'New lead' }} />
      <Stack.Screen name="LeadPull"   component={LeadPullScreen}   options={{ title: 'Pull from pool' }} />
    </Stack.Navigator>
  );
}
