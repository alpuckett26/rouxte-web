import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QuotesStackParamList } from '../types';
import QuotesScreen from '../screens/quotes/QuotesScreen';
import NewFiberQuoteScreen from '../screens/quotes/NewFiberQuoteScreen';
import NewWirelessQuoteScreen from '../screens/quotes/NewWirelessQuoteScreen';
import QuoteDetailScreen from '../screens/quotes/QuoteDetailScreen';

const Stack = createNativeStackNavigator<QuotesStackParamList>();

export default function QuotesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0f1e' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="QuotesList" component={QuotesScreen} options={{ title: 'Quotes' }} />
      <Stack.Screen name="NewFiberQuote" component={NewFiberQuoteScreen} options={{ title: 'Fiber Quote' }} />
      <Stack.Screen name="NewWirelessQuote" component={NewWirelessQuoteScreen} options={{ title: 'Wireless Quote' }} />
      <Stack.Screen name="QuoteDetail" component={QuoteDetailScreen} options={{ title: 'Quote' }} />
    </Stack.Navigator>
  );
}
