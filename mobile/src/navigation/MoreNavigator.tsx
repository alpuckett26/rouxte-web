import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/lib/colors';
import MoreScreen from '@/screens/more/MoreScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import NotificationsScreen from '@/screens/notifications/NotificationsScreen';
import TrainingHomeScreen from '@/screens/training/TrainingHomeScreen';
import TrainingModuleScreen from '@/screens/training/TrainingModuleScreen';
import TrainingQuizScreen from '@/screens/training/TrainingQuizScreen';
import CoachChatScreen from '@/screens/coach/CoachChatScreen';
import ResourcesScreen from '@/screens/resources/ResourcesScreen';
import CardScreen from '@/screens/card/CardScreen';
import StoreScreen from '@/screens/store/StoreScreen';
import MeetingsScreen from '@/screens/meetings/MeetingsScreen';
import ManagerScreen from '@/screens/manager/ManagerScreen';
import PayrollScreen from '@/screens/payroll/PayrollScreen';
import type { MoreStackParamList } from '@/types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function MoreNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="MoreHome"         component={MoreScreen}             options={{ headerShown: false }} />
      <Stack.Screen name="Training"         component={TrainingHomeScreen}     options={{ title: 'Training' }} />
      <Stack.Screen name="TrainingModule"   component={TrainingModuleScreen}   options={{ title: 'Module' }} />
      <Stack.Screen name="TrainingQuiz"     component={TrainingQuizScreen}     options={{ title: 'Quiz' }} />
      <Stack.Screen name="Coach"            component={CoachChatScreen}        options={{ title: 'AI Coach' }} />
      <Stack.Screen name="Notifications"    component={NotificationsScreen}    options={{ title: 'Notifications' }} />
      <Stack.Screen name="Resources"        component={ResourcesScreen}        options={{ title: 'Resources' }} />
      <Stack.Screen name="Card"             component={CardScreen}             options={{ title: 'Digital Card' }} />
      <Stack.Screen name="Store"            component={StoreScreen}            options={{ title: 'Store' }} />
      <Stack.Screen name="Meetings"         component={MeetingsScreen}         options={{ title: 'Meetings' }} />
      <Stack.Screen name="Manager"          component={ManagerScreen}          options={{ title: 'Manager' }} />
      <Stack.Screen name="Payroll"          component={PayrollScreen}          options={{ title: 'Payroll' }} />
      <Stack.Screen name="Settings"         component={SettingsScreen}         options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}
