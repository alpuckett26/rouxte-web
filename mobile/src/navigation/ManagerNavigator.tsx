import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/lib/colors';
import ManagerScreen from '@/screens/manager/ManagerScreen';
import QueueScreen from '@/screens/manager/QueueScreen';
import PeopleScreen from '@/screens/manager/PeopleScreen';
import TeamScreen from '@/screens/manager/TeamScreen';
import ComplianceScreen from '@/screens/manager/ComplianceScreen';
import CompensationScreen from '@/screens/manager/CompensationScreen';
import CoachScreen from '@/screens/manager/CoachScreen';
import GoalsManagerScreen from '@/screens/manager/GoalsManagerScreen';
import OnboardingMonitorScreen from '@/screens/manager/OnboardingMonitorScreen';
import TeamsScreen from '@/screens/manager/TeamsScreen';
import ManagerSmartPitchScreen from '@/screens/manager/ManagerSmartPitchScreen';
import PayrollPeriodsScreen from '@/screens/manager/PayrollPeriodsScreen';

export type ManagerStackParamList = {
  ManagerHome: undefined;
  Queue: undefined;
  People: undefined;
  Team: undefined;
  Compliance: undefined;
  Compensation: undefined;
  Coach: undefined;
  Goals: undefined;
  OnboardingMonitor: undefined;
  Teams: undefined;
  SmartPitch: undefined;
  PayrollPeriods: undefined;
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
      <Stack.Screen name="ManagerHome"       component={ManagerScreen}            options={{ title: 'Manager' }} />
      <Stack.Screen name="Queue"             component={QueueScreen}              options={{ title: 'Sales Queue' }} />
      <Stack.Screen name="People"            component={PeopleScreen}             options={{ title: 'People' }} />
      <Stack.Screen name="Team"              component={TeamScreen}               options={{ title: 'My Team' }} />
      <Stack.Screen name="Compliance"        component={ComplianceScreen}         options={{ title: 'Compliance' }} />
      <Stack.Screen name="Compensation"      component={CompensationScreen}       options={{ title: 'Compensation' }} />
      <Stack.Screen name="Coach"             component={CoachScreen}              options={{ title: 'Coach Knowledge' }} />
      <Stack.Screen name="Goals"             component={GoalsManagerScreen}       options={{ title: 'Goals' }} />
      <Stack.Screen name="OnboardingMonitor" component={OnboardingMonitorScreen}  options={{ title: 'Onboarding Monitor' }} />
      <Stack.Screen name="Teams"             component={TeamsScreen}              options={{ title: 'Teams' }} />
      <Stack.Screen name="SmartPitch"        component={ManagerSmartPitchScreen}  options={{ title: 'SmartPitch (Org)' }} />
      <Stack.Screen name="PayrollPeriods"    component={PayrollPeriodsScreen}     options={{ title: 'Payroll Periods' }} />
    </Stack.Navigator>
  );
}
