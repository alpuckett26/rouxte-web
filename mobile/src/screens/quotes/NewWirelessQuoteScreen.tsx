import React, { useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Screen, Text, Input, Button, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'NewWirelessQuote'>;

interface LineDraft {
  plan_type: string;
  rate_plan: number;
  next_up: boolean;
  insurance: number;
  device: number;
  device_promo: number;
}

const PLAN_TYPES = ['Unlimited Starter', 'Unlimited Extra', 'Unlimited Premium', 'FirstNet Mobile-Pro', '55+ Unlimited'];

export default function NewWirelessQuoteScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState('');
  const [email, setEmail] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { plan_type: PLAN_TYPES[1], rate_plan: 75, next_up: false, insurance: 0, device: 0, device_promo: 0 },
  ]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { plan_type: PLAN_TYPES[1], rate_plan: 75, next_up: false, insurance: 0, device: 0, device_promo: 0 },
    ]);
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const m = useMutation({
    mutationFn: () => quotesApi.create({
      quote_type: 'wireless',
      customer_name: customer || null,
      customer_email: email || null,
      total_lines: lines.length,
      monthly_total: lines.reduce((sum, l) =>
        sum + l.rate_plan + (l.next_up ? 8 : 0) + l.insurance + Math.max(0, l.device - l.device_promo), 0,
      ),
      lines: lines.map((l, i) => ({
        line_number: i + 1,
        plan_type: l.plan_type,
        rate_plan: l.rate_plan,
        plan_promo: 0,
        next_up: l.next_up,
        next_up_amt: l.next_up ? 8 : 0,
        insurance: l.insurance,
        retailer_promo: 0,
        device: l.device,
        device_promo: l.device_promo,
        line_total: l.rate_plan + (l.next_up ? 8 : 0) + l.insurance + Math.max(0, l.device - l.device_promo),
      })),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigation.replace('QuoteDetail', { quoteId: res.quote.id });
    },
    onError: (e: Error) => Alert.alert('Could not create quote', e.message),
  });

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>New wireless quote</Text>
      <Input label="Customer name" value={customer} onChangeText={setCustomer} />
      <Input label="Customer email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Text variant="caption" tone="dim" style={styles.label}>LINES</Text>
      {lines.map((line, i) => (
        <Card key={i} style={{ marginBottom: 8 }}>
          <View style={styles.lineHeader}>
            <Text weight="semibold">Line {i + 1}</Text>
            {lines.length > 1 && (
              <Pressable onPress={() => removeLine(i)}>
                <Text tone="danger">Remove</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.planRow}>
            {PLAN_TYPES.map((p) => (
              <Pressable
                key={p}
                onPress={() => updateLine(i, { plan_type: p })}
                style={[styles.chip, line.plan_type === p && styles.chipActive]}
              >
                <Text variant="caption" tone={line.plan_type === p ? 'default' : 'dim'}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.numRow}>
            <NumField label="Rate / mo" value={line.rate_plan} onChange={(v) => updateLine(i, { rate_plan: v })} />
            <NumField label="Insurance"  value={line.insurance} onChange={(v) => updateLine(i, { insurance: v })} />
          </View>
          <View style={styles.numRow}>
            <NumField label="Device"       value={line.device}       onChange={(v) => updateLine(i, { device: v })} />
            <NumField label="Device promo" value={line.device_promo} onChange={(v) => updateLine(i, { device_promo: v })} />
          </View>

          <Pressable onPress={() => updateLine(i, { next_up: !line.next_up })} style={styles.toggle}>
            <View style={[styles.checkbox, line.next_up && styles.checkboxOn]} />
            <Text>Next Up upgrade program (+$8/mo)</Text>
          </Pressable>
        </Card>
      ))}

      <Button title="+ Add line" onPress={addLine} variant="secondary" />

      <View style={{ marginTop: 16 }}>
        <Button title="Save quote" onPress={() => m.mutate()} loading={m.isPending} />
      </View>
    </Screen>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Input
        label={label}
        value={String(value)}
        onChangeText={(t) => onChange(Number(t.replace(/[^0-9.]/g, '')) || 0)}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label:       { marginTop: 12, marginBottom: 6, letterSpacing: 0.6 },
  lineHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  planRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip:        { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive:  { backgroundColor: colors.brand + '22', borderColor: colors.brand },
  numRow:      { flexDirection: 'row', gap: 8 },
  toggle:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox:    { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border },
  checkboxOn:  { backgroundColor: colors.brand, borderColor: colors.brand },
});
