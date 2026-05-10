import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types';
import LeadsNavigator from './LeadsNavigator';
import QuotesNavigator from './QuotesNavigator';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ActivityScreen from '../screens/activity/ActivityScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '⊞',
  Leads: '◎',
  Quotes: '◈',
  Activity: '◷',
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1BAEE1',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#0a0f1e',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
        tabBarIcon: ({ color, size }) => {
          const icon = TAB_ICONS[route.name] ?? '●';
          return <TabIcon icon={icon} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Leads" component={LeadsNavigator} />
      <Tab.Screen name="Quotes" component={QuotesNavigator} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
    </Tab.Navigator>
  );
}

function TabIcon({ icon, color }: { icon: string; color: string; size: number }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}
