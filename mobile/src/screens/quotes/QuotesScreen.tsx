import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Text, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'QuotesList'>;

export default function QuotesScreen({ navigation }: Props) {
  const q = useQuery({ queryKey: ['quotes'], queryFn: quotesApi.list });
  const quotes = q.data?.quotes ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="title" weight="bold">Quotes</Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.newBtn, { backgroundColor: colors.brand }]}
            onPress={() => navigation.navigate('NewFiberQuote', {})}
          >
            <Text weight="semibold">+ Fiber</Text>
          </Pressable>
          <Pressable
            style={[styles.newBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => navigation.navigate('NewWirelessQuote', {})}
          >
            <Text weight="semibold" tone="brand">+ Wireless</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.list}
        refreshing={q.isFetching && !q.isLoading}
        onRefresh={() => q.refetch()}
        ListEmptyComponent={
          q.isLoading ? null : <Text tone="mute" style={{ textAlign: 'center', marginTop: 36 }}>No quotes yet.</Text>
        }
        renderItem={({ item }) => (
          <Card
            onPress={() => navigation.navigate('QuoteDetail', { quoteId: item.id })}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text weight="semibold">{item.customer_name ?? 'Unnamed customer'}</Text>
              <Text tone="brand" weight="bold">${item.monthly_total.toFixed(2)}/mo</Text>
            </View>
            <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>
              {item.quote_type.toUpperCase()} · {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  header:  { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  newBtn:  { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  list:    { paddingHorizontal: 16, paddingBottom: 24 },
});
