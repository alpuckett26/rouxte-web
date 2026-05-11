import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/lib/colors';
import QuotesScreen from '@/screens/quotes/QuotesScreen';
import NewFiberQuoteScreen from '@/screens/quotes/NewFiberQuoteScreen';
import NewWirelessQuoteScreen from '@/screens/quotes/NewWirelessQuoteScreen';
import QuoteDetailScreen from '@/screens/quotes/QuoteDetailScreen';
import type { QuotesStackParamList } from '@/types';

const Stack = createNativeStackNavigator<QuotesStackParamList>();

export default function QuotesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="QuotesList"        component={QuotesScreen}              options={{ headerShown: false }} />
      <Stack.Screen name="NewFiberQuote"     component={NewFiberQuoteScreen}       options={{ title: 'Fiber quote' }} />
      <Stack.Screen name="NewWirelessQuote"  component={NewWirelessQuoteScreen}    options={{ title: 'Wireless quote' }} />
      <Stack.Screen name="QuoteDetail"       component={QuoteDetailScreen}         options={{ title: 'Quote' }} />
    </Stack.Navigator>
  );
}
