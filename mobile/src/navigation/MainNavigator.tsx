import React, { useEffect } from 'react';
import { Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/lib/colors';
import LeadsNavigator from './LeadsNavigator';
import QuotesNavigator from './QuotesNavigator';
import MoreNavigator from './MoreNavigator';
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import MapScreen from '@/screens/map/MapScreen';
import { SyncBadge } from '@/components/SyncBadge';
import { offlineQueue } from '@/lib/offlineQueue';
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
  const insets = useSafeAreaInsets();

  // Initialize the offline-write queue once when the authenticated app boots.
  // Listens to NetInfo and drains queued mutations on reconnect.
  useEffect(() => { void offlineQueue.init(); }, []);

  return (
    <View style={{ flex: 1 }}>
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

      {/* Global sync badge — floats top-center, only visible when the
          offline queue has pending mutations. */}
      <View pointerEvents="box-none" style={{
        position: 'absolute',
        top:      insets.top + 4,
        left:     0,
        right:    0,
        alignItems: 'center',
      }}>
        <SyncBadge />
      </View>
    </View>
  );
}
