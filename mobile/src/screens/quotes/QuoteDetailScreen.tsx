import React from 'react';
import { View, StyleSheet, Alert, Share } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Screen, Text, Card, Button } from '@/components/ui';
import { config } from '@/lib/config';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'QuoteDetail'>;

export default function QuoteDetailScreen({ route }: Props) {
  const { quoteId } = route.params;
  const q = useQuery({ queryKey: ['quote', quoteId], queryFn: () => quotesApi.get(quoteId) });

  if (!q.data) {
    return (
      <Screen loading>
        <View />
      </Screen>
    );
  }

  const quote = q.data.quote;
  const link = `${config.api.baseUrl}/quote/${quoteId}`;

  async function onShare() {
    try {
      await Share.share({ message: `Your Rouxte quote: ${link}` });
    } catch (e) {
      Alert.alert('Share failed', (e as Error).message);
    }
  }

  return (
    <Screen>
      <Text variant="caption" tone="dim">{quote.quote_type.toUpperCase()}</Text>
      <Text variant="title" weight="bold">{quote.customer_name ?? 'Unnamed'}</Text>
      <Text tone="dim" style={{ marginTop: 4 }}>
        {new Date(quote.created_at).toLocaleString()}
      </Text>

      <Card style={{ marginTop: 18, alignItems: 'center' }}>
        <Text variant="caption" tone="dim">MONTHLY TOTAL</Text>
        <Text variant="display" tone="brand" weight="bold">${quote.monthly_total.toFixed(2)}</Text>
      </Card>

      {quote.quote_type === 'wireless' && (quote.quote_lines ?? []).length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text variant="heading" weight="semibold" style={{ marginBottom: 8 }}>Lines</Text>
          {(quote.quote_lines ?? []).map((line) => (
            <Card key={line.id ?? line.line_number} style={{ marginBottom: 6 }}>
              <Text weight="medium">Line {line.line_number} · {line.plan_type}</Text>
              <Text tone="dim" variant="caption" style={{ marginTop: 4 }}>
                Rate ${line.rate_plan} · Insurance ${line.insurance} · Device ${line.device}
              </Text>
              <Text tone="brand" weight="bold">${line.line_total.toFixed(2)}/mo</Text>
            </Card>
          ))}
        </View>
      )}

      {quote.promo_note && (
        <Card style={{ marginTop: 18 }}>
          <Text variant="caption" tone="dim">PROMO</Text>
          <Text>{quote.promo_note}</Text>
        </Card>
      )}

      <View style={{ marginTop: 24, gap: 10 }}>
        <Button title="Share with customer" onPress={onShare} />
      </View>
    </Screen>
  );
}
