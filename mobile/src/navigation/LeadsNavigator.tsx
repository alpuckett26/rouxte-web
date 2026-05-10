import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LeadsStackParamList } from '../types';
import LeadsScreen from '../screens/leads/LeadsScreen';
import LeadDetailScreen from '../screens/leads/LeadDetailScreen';
import NewLeadScreen from '../screens/leads/NewLeadScreen';

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export default function LeadsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0f1e' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="LeadsList" component={LeadsScreen} options={{ title: 'Leads' }} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Lead' }} />
      <Stack.Screen name="NewLead" component={NewLeadScreen} options={{ title: 'New Lead' }} />
    </Stack.Navigator>
  );
}
