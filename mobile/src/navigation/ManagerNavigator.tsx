import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/lib/colors';
import ManagerScreen from '@/screens/manager/ManagerScreen';
import QueueScreen from '@/screens/manager/QueueScreen';
import PeopleScreen from '@/screens/manager/PeopleScreen';

export type ManagerStackParamList = {
  ManagerHome: undefined;
  Queue: undefined;
  People: undefined;
};

const Stack = createNativeStackNavigator<ManagerStackParamList>();

export default function ManagerNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="ManagerHome" component={ManagerScreen} options={{ title: 'Manager' }} />
      <Stack.Screen name="Queue"       component={QueueScreen}   options={{ title: 'Sales Queue' }} />
      <Stack.Screen name="People"      component={PeopleScreen}  options={{ title: 'People' }} />
    </Stack.Navigator>
  );
}
