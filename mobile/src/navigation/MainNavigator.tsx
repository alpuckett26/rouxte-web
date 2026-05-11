import React from 'react';
import { Text as RNText } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/lib/colors';
import LeadsNavigator from './LeadsNavigator';
import QuotesNavigator from './QuotesNavigator';
import MoreNavigator from './MoreNavigator';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import MapScreen from '@/screens/map/MapScreen';
import type { MainTabParamList } from '@/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '⊞',
  Leads:     '◎',
  Map:       '◉',
  Quotes:    '◈',
  More:      '☰',
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   colors.brand,
        tabBarInactiveTintColor: colors.textMute,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          60,
        },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
        tabBarIcon: ({ color }) => {
          const icon = TAB_ICONS[route.name] ?? '●';
          return <RNText style={{ fontSize: 20, color }}>{icon}</RNText>;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Leads"     component={LeadsNavigator} />
      <Tab.Screen name="Map"       component={MapScreen} />
      <Tab.Screen name="Quotes"    component={QuotesNavigator} />
      <Tab.Screen name="More"      component={MoreNavigator} />
    </Tab.Navigator>
  );
}
