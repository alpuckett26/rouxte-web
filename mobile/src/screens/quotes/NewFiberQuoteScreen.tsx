import React, { useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Screen, Text, Input, Button, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'NewFiberQuote'>;

// Plan list mirrors web's lib/quoting/fiber-pricing.ts (server-authoritative — values here are display only).
const PLANS = [
  { id: 'fiber_300',  label: 'Fiber 300 Mbps',  price: 55 },
  { id: 'fiber_500',  label: 'Fiber 500 Mbps',  price: 65 },
  { id: 'fiber_1000', label: 'Fiber 1 Gig',     price: 80 },
  { id: 'fiber_2000', label: 'Fiber 2 Gig',     price: 110 },
  { id: 'fiber_5000', label: 'Fiber 5 Gig',     price: 180 },
];

export default function NewFiberQuoteScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState(PLANS[2].id);
  const [autopay, setAutopay] = useState(true);
  const [promo, setPromo] = useState('');

  const m = useMutation({
    mutationFn: () => quotesApi.create({
      quote_type: 'fiber',
      customer_name: customer || null,
      customer_email: email || null,
      fiber_plan: plan,
      autopay_paperless: autopay,
      promo_note: promo || null,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigation.replace('QuoteDetail', { quoteId: res.quote.id });
    },
    onError: (e: Error) => Alert.alert('Could not create quote', e.message),
  });

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>New fiber quote</Text>
      <Input label="Customer name" value={customer} onChangeText={setCustomer} />
      <Input label="Customer email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Text variant="caption" tone="dim" style={styles.label}>PLAN</Text>
      {PLANS.map((p) => (
        <Pressable key={p.id} onPress={() => setPlan(p.id)}>
          <Card style={[styles.row, plan === p.id && styles.rowActive]}>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">{p.label}</Text>
            </View>
            <Text tone="brand" weight="bold">${p.price}/mo</Text>
          </Card>
        </Pressable>
      ))}

      <Pressable onPress={() => setAutopay(!autopay)} style={styles.toggle}>
        <View style={[styles.checkbox, autopay && styles.checkboxOn]} />
        <Text>Autopay + paperless (−$10/mo discount)</Text>
      </Pressable>

      <Input label="Promo note (optional)" value={promo} onChangeText={setPromo} multiline />

      <View style={{ marginTop: 16 }}>
        <Button title="Save quote" onPress={() => m.mutate()} loading={m.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label:      { marginTop: 12, marginBottom: 6, letterSpacing: 0.6 },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  rowActive:  { borderColor: colors.brand, backgroundColor: colors.brand + '11' },
  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 8 },
  checkbox:   { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
});
