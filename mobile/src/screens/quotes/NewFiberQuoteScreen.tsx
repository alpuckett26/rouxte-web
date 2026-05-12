import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Screen, Text, Input, Button, Card, Badge } from '@/components/ui';
import { colors } from '@/lib/colors';
import {
  FIBER_PLANS,
  FIBER_PLAN_GROUPS,
  getFiberRate,
  WIRELESS_BUNDLE_DISCOUNT_PCT,
  type FiberPlanId,
} from '@/lib/fiberPricing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'NewFiberQuote'>;

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function NewFiberQuoteScreen({ navigation }: Props) {
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<FiberPlanId | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [autopay, setAutopay] = useState(true);
  const [wirelessBundle, setWirelessBundle] = useState(false);
  const [promoNote, setPromoNote] = useState('');

  const plan = selectedPlanId ? FIBER_PLANS.find((p) => p.id === selectedPlanId) ?? null : null;
  const isAccess = selectedPlanId === 'access';
  const bundleOn = wirelessBundle && !isAccess;
  const rate = plan ? getFiberRate(selectedPlanId!, autopay, bundleOn) : 0;

  const autopayDiscount = plan && autopay && !isAccess ? plan.basePrice - plan.autopayPrice : 0;
  const bundleBase = autopay ? (plan?.autopayPrice ?? 0) : (plan?.basePrice ?? 0);
  const bundleDiscount = bundleOn ? parseFloat((bundleBase * WIRELESS_BUNDLE_DISCOUNT_PCT).toFixed(2)) : 0;

  const save = useMutation({
    mutationFn: () => quotesApi.create({
      quote_type: 'fiber',
      customer_name: customerName.trim() || null,
      customer_email: customerEmail.trim() || null,
      promo_note: promoNote.trim() || null,
      fiber_plan: selectedPlanId,
      total_lines: 1,
      autopay_paperless: autopay,
      wireless_bundle: bundleOn,
      discount_type: 'none',
      monthly_total: rate,
      activation_fee: 0,
      lines: [{
        line_number: 1,
        plan_type: selectedPlanId!,
        rate_plan: rate,
        plan_promo: 0,
        next_up: false,
        next_up_amt: 0,
        insurance: 0,
        retailer_promo: 0,
        device: 0,
        device_promo: 0,
        line_total: rate,
      }],
    } as never),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigation.replace('QuoteDetail', { quoteId: res.quote.id });
    },
    onError: (e: Error) => Alert.alert('Could not save quote', e.message),
  });

  return (
    <Screen>
      <View>
        <Text variant="title" weight="bold">AT&T Fiber Quote</Text>
        <Text variant="caption" tone="dim">Build a fiber internet quote for your customer.</Text>
      </View>

      {/* Step tabs */}
      <View style={styles.stepRow}>
        <Pressable
          onPress={() => setStep(1)}
          style={[styles.stepTab, step === 1 && styles.stepTabActive]}
        >
          <Text variant="caption" weight="semibold" tone={step === 1 ? 'brand' : 'dim'}>
            Step 1 · Plan
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { if (selectedPlanId) setStep(2); }}
          style={[styles.stepTab, step === 2 && styles.stepTabActive, !selectedPlanId && { opacity: 0.4 }]}
          disabled={!selectedPlanId}
        >
          <Text variant="caption" weight="semibold" tone={step === 2 ? 'brand' : 'dim'}>
            Step 2 · Summary
          </Text>
        </Pressable>
      </View>

      {step === 1 ? (
        <Step1
          customerName={customerName} setCustomerName={setCustomerName}
          customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
          selectedPlanId={selectedPlanId} setSelectedPlanId={setSelectedPlanId}
          onNext={() => setStep(2)}
        />
      ) : (
        <Step2
          plan={plan!}
          isAccess={isAccess}
          autopay={autopay} setAutopay={setAutopay}
          bundleOn={bundleOn} setWirelessBundle={setWirelessBundle}
          promoNote={promoNote} setPromoNote={setPromoNote}
          autopayDiscount={autopayDiscount}
          bundleDiscount={bundleDiscount}
          rate={rate}
          onBack={() => setStep(1)}
          onSave={() => save.mutate()}
          saving={save.isPending}
        />
      )}
    </Screen>
  );
}

function Step1({
  customerName, setCustomerName, customerEmail, setCustomerEmail,
  selectedPlanId, setSelectedPlanId, onNext,
}: {
  customerName: string; setCustomerName: (v: string) => void;
  customerEmail: string; setCustomerEmail: (v: string) => void;
  selectedPlanId: FiberPlanId | null; setSelectedPlanId: (id: FiberPlanId) => void;
  onNext: () => void;
}) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      <Card>
        <Text variant="caption" tone="dim" weight="semibold">CUSTOMER</Text>
        <Input
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Customer name (optional)"
          autoComplete="name"
          style={{ marginTop: 8, marginBottom: 8 }}
        />
        <View>
          <Input
            value={customerEmail}
            onChangeText={setCustomerEmail}
            placeholder="Customer email — they get the PDF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {customerEmail.length > 0 && (
            <View style={{ position: 'absolute', right: 10, top: 8 }}>
              <Badge label="Quote will be emailed" color="green" />
            </View>
          )}
        </View>
      </Card>

      {FIBER_PLAN_GROUPS.map((group) => (
        <Card key={group.label}>
          <Text variant="caption" tone="dim" weight="semibold">{group.label.toUpperCase()}</Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            {group.ids.map((planId) => {
              const p = FIBER_PLANS.find((fp) => fp.id === planId)!;
              const selected = selectedPlanId === planId;
              return (
                <Pressable
                  key={planId}
                  onPress={() => setSelectedPlanId(planId)}
                  style={[styles.planRow, selected && styles.planRowSelected]}
                >
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold" tone={selected ? 'brand' : 'default'}>{p.label}</Text>
                    <Text variant="caption" tone="dim">{p.speed}</Text>
                    {p.notes && <Text variant="caption" tone="mute" style={{ marginTop: 2 }}>{p.notes}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="heading" weight="bold" tone={selected ? 'brand' : 'default'}>{fmt(p.autopayPrice)}</Text>
                    <Text variant="caption" tone="mute">/mo w/ AutoPay</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}

      <Button title="Next: Summary →" onPress={onNext} disabled={!selectedPlanId} />
    </View>
  );
}

function Step2({
  plan, isAccess,
  autopay, setAutopay,
  bundleOn, setWirelessBundle,
  promoNote, setPromoNote,
  autopayDiscount, bundleDiscount,
  rate, onBack, onSave, saving,
}: {
  plan: typeof FIBER_PLANS[number];
  isAccess: boolean;
  autopay: boolean; setAutopay: (v: boolean) => void;
  bundleOn: boolean; setWirelessBundle: (v: boolean) => void;
  promoNote: string; setPromoNote: (v: string) => void;
  autopayDiscount: number; bundleDiscount: number;
  rate: number;
  onBack: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      {/* Selected plan banner */}
      <Pressable onPress={onBack}>
        <Card style={{ borderColor: colors.brand, backgroundColor: colors.brand + '11' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text weight="bold" tone="brand">{plan.label}</Text>
              <Text variant="caption" tone="dim">{plan.speed}</Text>
            </View>
            <Text variant="caption" tone="brand">Change</Text>
          </View>
        </Card>
      </Pressable>

      {/* Discounts */}
      <Card>
        <Text variant="caption" tone="dim" weight="semibold" style={{ marginBottom: 12 }}>DISCOUNTS</Text>

        <Pressable
          onPress={() => !isAccess && setAutopay(!autopay)}
          style={styles.toggleRow}
          disabled={isAccess}
        >
          <View style={[styles.checkbox, autopay && !isAccess && styles.checkboxOn, isAccess && { opacity: 0.4 }]}>
            {autopay && !isAccess && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium" tone={isAccess ? 'mute' : 'default'}>AutoPay + Paperless Billing</Text>
            <Text variant="caption" tone="dim">
              {isAccess ? 'No AutoPay discount for AT&T Access' : `Saves $${plan.basePrice - plan.autopayPrice}/mo`}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => !isAccess && setWirelessBundle(!bundleOn)}
          style={[styles.toggleRow, { marginTop: 10 }]}
          disabled={isAccess}
        >
          <View style={[styles.checkbox, bundleOn && styles.checkboxOn, isAccess && { opacity: 0.4 }]}>
            {bundleOn && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium" tone={isAccess ? 'mute' : 'default'}>Wireless Bundle Discount</Text>
            <Text variant="caption" tone="dim">20% off — customer must have an eligible AT&T wireless plan</Text>
          </View>
        </Pressable>

        {isAccess && (
          <View style={styles.accessNote}>
            <Text variant="caption" tone="warning">
              AT&T Access is a fixed-rate low-income program ($30/mo). Discounts don't apply.
              Customer must qualify via SNAP, Medicaid, or similar.
            </Text>
          </View>
        )}
      </Card>

      {/* Promo note */}
      <Card>
        <Text variant="caption" tone="dim" weight="semibold">CURRENT PROMOTION</Text>
        <Text variant="caption" tone="mute" style={{ marginTop: 2, marginBottom: 8 }}>
          Shown on the customer's quote — e.g. "$100 gift card for new subscribers"
        </Text>
        <Input
          value={promoNote}
          onChangeText={setPromoNote}
          placeholder="Leave blank if no active promo"
          multiline
        />
      </Card>

      {/* Price breakdown */}
      <Card>
        <Text variant="caption" tone="dim" weight="semibold" style={{ marginBottom: 8 }}>PRICE BREAKDOWN</Text>

        <View style={styles.priceRow}>
          <Text variant="caption" tone="dim">{plan.label} — base price</Text>
          <Text variant="caption">{fmt(plan.basePrice)}/mo</Text>
        </View>

        {autopayDiscount > 0 && (
          <View style={styles.priceRow}>
            <Text variant="caption" tone="dim">AutoPay & Paperless</Text>
            <Text variant="caption" tone="success">−{fmt(autopayDiscount)}/mo</Text>
          </View>
        )}

        {bundleDiscount > 0 && (
          <View style={styles.priceRow}>
            <Text variant="caption" tone="dim">Wireless bundle (20%)</Text>
            <Text variant="caption" tone="success">−{fmt(bundleDiscount)}/mo</Text>
          </View>
        )}

        <View style={[styles.priceRow, styles.totalRow]}>
          <Text weight="bold">Monthly Total</Text>
          <Text variant="title" weight="bold" tone="brand">{fmt(rate)}/mo</Text>
        </View>

        <Text variant="caption" tone="mute" style={{ marginTop: 8 }}>
          No activation fee. Gateway included.
        </Text>
      </Card>

      <Button
        title={saving ? 'Saving…' : 'Save quote'}
        onPress={onSave}
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow:         { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 4 },
  stepTab:         { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  stepTabActive:   { backgroundColor: colors.brand + '22', borderWidth: 1, borderColor: colors.brand },
  planRow:         {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  planRowSelected: { borderColor: colors.brand, backgroundColor: colors.brand + '11' },
  toggleRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn:      { backgroundColor: colors.brand, borderColor: colors.brand },
  accessNote:      { marginTop: 12, padding: 10, backgroundColor: colors.warning + '22', borderColor: colors.warning + '44', borderWidth: 1, borderRadius: 8 },
  priceRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalRow:        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 8, paddingTop: 10 },
});
