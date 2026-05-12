import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/api/quotes';
import { Screen, Text, Input, Button, Card, Badge, Modal, Select, type SelectOption } from '@/components/ui';
import { colors } from '@/lib/colors';
import {
  getRate,
  ACTIVATION_FEE,
  NEXT_UP_FEE,
  PLAN_LABELS,
  CARRIER_GUIDE,
  APPRECIATION_TYPES,
  type PlanType,
  type DiscountType,
} from '@/lib/wirelessPricing';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuotesStackParamList } from '@/types';

type Props = NativeStackScreenProps<QuotesStackParamList, 'NewWirelessQuote'>;

const fmt = (n: number) => `$${n.toFixed(2)}`;

interface QuoteLineDraft {
  line_number: number;
  plan_type: PlanType;
  rate_plan: number;
  plan_promo: number;
  next_up: boolean;
  next_up_amt: number;
  insurance: number;
  retailer_promo: number;
  device: number;
  device_promo: number;
  line_total: number;
  is_portin: boolean;
  portin_phone: string;
  portin_carrier: string;
  portin_account: string;
  portin_pin: string;
}

function calcLineTotal(l: QuoteLineDraft): number {
  return l.rate_plan - l.plan_promo + (l.next_up ? l.next_up_amt : 0) + l.insurance - l.retailer_promo + l.device - l.device_promo;
}

function buildLines(
  counts: Record<PlanType, number>,
  totalLines: number,
  portInCount: number,
  autopay: boolean,
  discount: DiscountType,
  existing: QuoteLineDraft[],
): QuoteLineDraft[] {
  const planSeq: PlanType[] = (Object.keys(counts) as PlanType[]).flatMap((p) =>
    Array(counts[p]).fill(p),
  );
  return planSeq.map((p, i) => {
    const prev = existing[i];
    const rate = getRate(p, totalLines, autopay, discount);
    const line: QuoteLineDraft = {
      line_number:    i + 1,
      plan_type:      p,
      rate_plan:      rate,
      plan_promo:     prev?.plan_promo ?? 0,
      next_up:        prev?.next_up ?? false,
      next_up_amt:    NEXT_UP_FEE,
      insurance:      prev?.insurance ?? 0,
      retailer_promo: prev?.retailer_promo ?? 0,
      device:         prev?.device ?? 0,
      device_promo:   prev?.device_promo ?? 0,
      line_total:     0,
      is_portin:      i < portInCount,
      portin_phone:   prev?.portin_phone ?? '',
      portin_carrier: prev?.portin_carrier ?? '',
      portin_account: prev?.portin_account ?? '',
      portin_pin:     prev?.portin_pin ?? '',
    };
    line.line_total = calcLineTotal(line);
    return line;
  });
}

export default function NewWirelessQuoteScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [premiumCount, setPremiumCount] = useState(1);
  const [extraCount, setExtraCount] = useState(0);
  const [starterCount, setStarterCount] = useState(0);
  const [firstnetUnlimitedCount, setFirstnetUnlimitedCount] = useState(0);
  const [firstnetExtraCount, setFirstnetExtraCount] = useState(0);
  const [senior55Count, setSenior55Count] = useState(0);

  const [autopay, setAutopay] = useState(true);
  const [discount, setDiscount] = useState<DiscountType>('none');
  const [appreciationType, setAppreciationType] = useState<string | null>(null);
  const [portIn, setPortIn] = useState(0);
  const [newLine, setNewLine] = useState(1);
  const [upgrade, setUpgrade] = useState(0);

  const [lines, setLines] = useState<QuoteLineDraft[]>([]);
  const [carrierGuideOpen, setCarrierGuideOpen] = useState(false);

  const counts: Record<PlanType, number> = {
    premium:            premiumCount,
    extra:              extraCount,
    starter:            starterCount,
    firstnet_unlimited: firstnetUnlimitedCount,
    firstnet_extra:     firstnetExtraCount,
    senior_55plus:      senior55Count,
  };
  const totalLines = Object.values(counts).reduce((a, b) => a + b, 0);
  const senior55Warning = senior55Count > 0 && totalLines < 2;

  // Recalculate lines whenever counts / autopay / discount / portIn change
  useEffect(() => {
    if (totalLines === 0) { setLines([]); return; }
    setLines((prev) => buildLines(counts, totalLines, portIn, autopay, discount, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiumCount, extraCount, starterCount, firstnetUnlimitedCount, firstnetExtraCount, senior55Count, portIn, autopay, discount]);

  function updateLine(i: number, patch: Partial<QuoteLineDraft>) {
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      const merged = { ...l, ...patch };
      return { ...merged, line_total: calcLineTotal(merged) };
    }));
  }

  const monthlyTotal = useMemo(() => lines.reduce((s, l) => s + l.line_total, 0), [lines]);
  const activationFee = (portIn + newLine) * ACTIVATION_FEE;

  const save = useMutation({
    mutationFn: () => quotesApi.create({
      quote_type:        'wireless',
      customer_name:     customerName.trim() || null,
      customer_email:    customerEmail.trim() || null,
      total_lines:       totalLines,
      autopay_paperless: autopay,
      discount_type:     discount,
      monthly_total:     monthlyTotal,
      activation_fee:    activationFee,
      lines: lines.map((l) => ({
        line_number:    l.line_number,
        plan_type:      l.plan_type,
        rate_plan:      l.rate_plan,
        plan_promo:     l.plan_promo,
        next_up:        l.next_up,
        next_up_amt:    l.next_up_amt,
        insurance:      l.insurance,
        retailer_promo: l.retailer_promo,
        device:         l.device,
        device_promo:   l.device_promo,
        line_total:     l.line_total,
      })),
    } as never),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      navigation.replace('QuoteDetail', { quoteId: res.quote.id });
    },
    onError: (e: Error) => Alert.alert('Could not save quote', e.message),
  });

  return (
    <Screen>
      <Text variant="title" weight="bold">AT&T Wireless Quote</Text>
      <Text variant="caption" tone="dim">From the AT&T Billing & Quote Worksheet.</Text>

      {/* Step tabs */}
      <View style={styles.stepRow}>
        {[1, 2, 3].map((s) => (
          <Pressable
            key={s}
            onPress={() => { if (s < step || (s === 2 && totalLines > 0)) setStep(s as 1 | 2 | 3); }}
            style={[styles.stepTab, step === s && styles.stepTabActive, (s > step && !(s === 2 && totalLines > 0)) && { opacity: 0.4 }]}
            disabled={s > step && !(s === 2 && totalLines > 0)}
          >
            <Text variant="caption" weight="semibold" tone={step === s ? 'brand' : 'dim'}>
              {s === 1 ? 'Setup' : s === 2 ? 'Per Line' : 'Summary'}
            </Text>
          </Pressable>
        ))}
      </View>

      {step === 1 && (
        <Step1
          customerName={customerName} setCustomerName={setCustomerName}
          customerEmail={customerEmail} setCustomerEmail={setCustomerEmail}
          premiumCount={premiumCount} setPremiumCount={setPremiumCount}
          extraCount={extraCount} setExtraCount={setExtraCount}
          starterCount={starterCount} setStarterCount={setStarterCount}
          firstnetUnlimitedCount={firstnetUnlimitedCount} setFirstnetUnlimitedCount={setFirstnetUnlimitedCount}
          firstnetExtraCount={firstnetExtraCount} setFirstnetExtraCount={setFirstnetExtraCount}
          senior55Count={senior55Count} setSenior55Count={setSenior55Count}
          autopay={autopay} setAutopay={setAutopay}
          discount={discount} setDiscount={setDiscount}
          appreciationType={appreciationType} setAppreciationType={setAppreciationType}
          portIn={portIn} setPortIn={setPortIn}
          newLine={newLine} setNewLine={setNewLine}
          upgrade={upgrade} setUpgrade={setUpgrade}
          totalLines={totalLines}
          senior55Warning={senior55Warning}
          onNext={() => totalLines > 0 && !senior55Warning && setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          lines={lines}
          updateLine={updateLine}
          onCarrierGuide={() => setCarrierGuideOpen(true)}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3
          lines={lines}
          customerName={customerName}
          customerEmail={customerEmail}
          totalLines={totalLines}
          monthlyTotal={monthlyTotal}
          activationFee={activationFee}
          portIn={portIn}
          newLine={newLine}
          upgrade={upgrade}
          discount={discount}
          autopay={autopay}
          onBack={() => setStep(2)}
          onSave={() => save.mutate()}
          saving={save.isPending}
        />
      )}

      <CarrierGuideModal visible={carrierGuideOpen} onClose={() => setCarrierGuideOpen(false)} />
    </Screen>
  );
}

// ── Step 1: Setup ───────────────────────────────────────────────────────────
function Step1(props: {
  customerName: string; setCustomerName: (v: string) => void;
  customerEmail: string; setCustomerEmail: (v: string) => void;
  premiumCount: number; setPremiumCount: (v: number) => void;
  extraCount: number; setExtraCount: (v: number) => void;
  starterCount: number; setStarterCount: (v: number) => void;
  firstnetUnlimitedCount: number; setFirstnetUnlimitedCount: (v: number) => void;
  firstnetExtraCount: number; setFirstnetExtraCount: (v: number) => void;
  senior55Count: number; setSenior55Count: (v: number) => void;
  autopay: boolean; setAutopay: (v: boolean) => void;
  discount: DiscountType; setDiscount: (v: DiscountType) => void;
  appreciationType: string | null; setAppreciationType: (v: string | null) => void;
  portIn: number; setPortIn: (v: number) => void;
  newLine: number; setNewLine: (v: number) => void;
  upgrade: number; setUpgrade: (v: number) => void;
  totalLines: number;
  senior55Warning: boolean;
  onNext: () => void;
}) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      <Card>
        <Text variant="caption" tone="dim" weight="semibold">CUSTOMER</Text>
        <Input value={props.customerName} onChangeText={props.setCustomerName} placeholder="Name (optional)" style={{ marginTop: 8 }} />
        <Input value={props.customerEmail} onChangeText={props.setCustomerEmail} placeholder="Email — sends them the PDF" keyboardType="email-address" autoCapitalize="none" />
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold">STANDARD PLANS</Text>
        <Stepper label="Premium" val={props.premiumCount} set={props.setPremiumCount} />
        <Stepper label="Extra"   val={props.extraCount}   set={props.setExtraCount} />
        <Stepper label="Starter" val={props.starterCount} set={props.setStarterCount} />
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold">SPECIALIZED PLANS</Text>
        <Stepper label="FirstNet Unlimited" val={props.firstnetUnlimitedCount} set={props.setFirstnetUnlimitedCount} sub="~$43/line w/ autopay" />
        <Stepper label="FirstNet Extra"     val={props.firstnetExtraCount}     set={props.setFirstnetExtraCount}     sub="~$48/line w/ autopay" />
        <Stepper label="55+ Plan"           val={props.senior55Count}          set={props.setSenior55Count}          sub="$35/line w/ autopay · min 2 lines" />
        {props.senior55Warning && (
          <View style={styles.warnBox}>
            <Text variant="caption" tone="warning">⚠ 55+ Plan requires at least 2 lines total.</Text>
          </View>
        )}
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold">LINE BREAKDOWN</Text>
        <Stepper label="Port-in"     val={props.portIn}  set={props.setPortIn}  sub={`+ $${ACTIVATION_FEE} activation each`} />
        <Stepper label="New line"    val={props.newLine} set={props.setNewLine} sub={`+ $${ACTIVATION_FEE} activation each`} />
        <Stepper label="Upgrade"     val={props.upgrade} set={props.setUpgrade} sub="No activation fee" />
      </Card>

      <Card>
        <Pressable onPress={() => props.setAutopay(!props.autopay)} style={styles.toggleRow}>
          <View style={[styles.checkbox, props.autopay && styles.checkboxOn]}>
            {props.autopay && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium">AutoPay + Paperless Billing</Text>
            <Text variant="caption" tone="dim">$10/line discount</Text>
          </View>
        </Pressable>
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold" style={{ marginBottom: 8 }}>DISCOUNT</Text>
        <View style={{ gap: 6 }}>
          {(['none', 'appreciation', 'signature'] as DiscountType[]).map((d) => (
            <Pressable
              key={d}
              onPress={() => props.setDiscount(d)}
              style={[styles.discountRow, props.discount === d && styles.discountRowSelected]}
            >
              <View style={[styles.radio, props.discount === d && styles.radioOn]} />
              <Text>{d === 'none' ? 'None' : d === 'appreciation' ? 'Appreciation (25% off)' : 'Signature ($10/line off)'}</Text>
            </Pressable>
          ))}
        </View>
        {props.discount === 'appreciation' && (
          <View style={{ marginTop: 10 }}>
            <Select
              label="Appreciation type"
              value={props.appreciationType}
              onChange={props.setAppreciationType}
              options={APPRECIATION_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </View>
        )}
      </Card>

      <Button title={`Next: Configure ${props.totalLines} line${props.totalLines === 1 ? '' : 's'} →`}
        onPress={props.onNext}
        disabled={props.totalLines === 0 || props.senior55Warning} />
    </View>
  );
}

// ── Step 2: Per-line ────────────────────────────────────────────────────────
function Step2({
  lines, updateLine, onCarrierGuide, onBack, onNext,
}: {
  lines: QuoteLineDraft[];
  updateLine: (i: number, patch: Partial<QuoteLineDraft>) => void;
  onCarrierGuide: () => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      {lines.map((line, i) => (
        <Card key={i}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text weight="bold">Line {line.line_number} · {PLAN_LABELS[line.plan_type]}</Text>
            <Text variant="caption" tone="brand" weight="bold">{fmt(line.line_total)}/mo</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <NumField label="Rate (locked)"  value={line.rate_plan}    onChange={() => {}} disabled />
            <NumField label="Plan promo (−)" value={line.plan_promo}   onChange={(v) => updateLine(i, { plan_promo: v })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <NumField label="Insurance"       value={line.insurance}    onChange={(v) => updateLine(i, { insurance: v })} />
            <NumField label="Retailer promo (−)" value={line.retailer_promo} onChange={(v) => updateLine(i, { retailer_promo: v })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <NumField label="Device"          value={line.device}       onChange={(v) => updateLine(i, { device: v })} />
            <NumField label="Device promo (−)" value={line.device_promo} onChange={(v) => updateLine(i, { device_promo: v })} />
          </View>

          <Pressable
            onPress={() => updateLine(i, { next_up: !line.next_up })}
            style={[styles.toggleRow, { marginTop: 4 }]}
          >
            <View style={[styles.checkbox, line.next_up && styles.checkboxOn]}>
              {line.next_up && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
            </View>
            <Text>NextUp upgrade program (+${NEXT_UP_FEE}/mo)</Text>
          </Pressable>

          {line.is_portin && (
            <View style={styles.portInBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Badge label="PORT-IN" color="purple" dot />
                </View>
                <Pressable onPress={onCarrierGuide}>
                  <Text variant="caption" tone="brand">PIN guide →</Text>
                </Pressable>
              </View>
              <Input label="Phone #" value={line.portin_phone} onChangeText={(v) => updateLine(i, { portin_phone: v })} keyboardType="phone-pad" />
              <Input label="Current carrier" value={line.portin_carrier} onChangeText={(v) => updateLine(i, { portin_carrier: v })} />
              <Input label="Account #" value={line.portin_account} onChangeText={(v) => updateLine(i, { portin_account: v })} />
              <Input label="Transfer PIN" value={line.portin_pin} onChangeText={(v) => updateLine(i, { portin_pin: v })} />
            </View>
          )}
        </Card>
      ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="← Back" onPress={onBack} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
        <Button title="Next: Summary →" onPress={onNext} fullWidth={false} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ── Step 3: Summary ─────────────────────────────────────────────────────────
function Step3({
  lines, customerName, customerEmail, totalLines, monthlyTotal, activationFee,
  portIn, newLine, upgrade, discount, autopay, onBack, onSave, saving,
}: {
  lines: QuoteLineDraft[];
  customerName: string; customerEmail: string;
  totalLines: number; monthlyTotal: number; activationFee: number;
  portIn: number; newLine: number; upgrade: number;
  discount: DiscountType; autopay: boolean;
  onBack: () => void; onSave: () => void; saving: boolean;
}) {
  return (
    <View style={{ gap: 14, marginTop: 14 }}>
      <Card>
        <Text variant="caption" tone="dim" weight="semibold">CUSTOMER</Text>
        <Text weight="semibold" style={{ marginTop: 4 }}>{customerName || '—'}</Text>
        {customerEmail && <Text variant="caption" tone="dim">{customerEmail}</Text>}
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold" style={{ marginBottom: 8 }}>LINES</Text>
        {lines.map((l) => (
          <View key={l.line_number} style={styles.summaryLine}>
            <View style={{ flex: 1 }}>
              <Text weight="medium">Line {l.line_number} · {PLAN_LABELS[l.plan_type]}</Text>
              {l.is_portin && <Text variant="caption" tone="dim">Port from {l.portin_carrier || '—'}: {l.portin_phone || '—'}</Text>}
            </View>
            <Text variant="caption" weight="bold" tone="brand">{fmt(l.line_total)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="caption" tone="dim" weight="semibold" style={{ marginBottom: 8 }}>ACCOUNT</Text>
        <View style={styles.summaryLine}>
          <Text variant="caption" tone="dim">Total lines</Text>
          <Text variant="caption">{totalLines}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text variant="caption" tone="dim">Discount</Text>
          <Text variant="caption">{discount === 'none' ? 'None' : discount === 'appreciation' ? 'Appreciation' : 'Signature'}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text variant="caption" tone="dim">AutoPay</Text>
          <Text variant="caption">{autopay ? 'Yes' : 'No'}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text variant="caption" tone="dim">Port-in / New / Upgrade</Text>
          <Text variant="caption">{portIn} / {newLine} / {upgrade}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Text variant="caption" tone="dim">Activation fee</Text>
          <Text variant="caption">{fmt(activationFee)}</Text>
        </View>
      </Card>

      <Card style={{ borderColor: colors.brand }}>
        <View style={styles.summaryLine}>
          <Text variant="heading" weight="bold">Monthly Total</Text>
          <Text variant="display" weight="bold" tone="brand">{fmt(monthlyTotal)}</Text>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="← Back" onPress={onBack} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
        <Button title={saving ? 'Saving…' : 'Save quote'} onPress={onSave} loading={saving} fullWidth={false} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Stepper({ label, val, set, sub }: { label: string; val: number; set: (n: number) => void; sub?: string }) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {sub && <Text variant="caption" tone="mute">{sub}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => set(Math.max(0, val - 1))} style={[styles.stepperBtn, { backgroundColor: colors.bgInput }]}>
          <Text weight="bold">−</Text>
        </Pressable>
        <Text weight="bold" style={{ width: 24, textAlign: 'center' }}>{val}</Text>
        <Pressable onPress={() => set(Math.min(10, val + 1))} style={[styles.stepperBtn, { backgroundColor: colors.brand + '33' }]}>
          <Text weight="bold" tone="brand">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Input
        label={label}
        value={String(value)}
        onChangeText={(t) => onChange(Number(t.replace(/[^0-9.]/g, '')) || 0)}
        keyboardType="decimal-pad"
        editable={!disabled}
        style={disabled ? { opacity: 0.6 } : undefined}
      />
    </View>
  );
}

function CarrierGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} onClose={onClose} title="Port-in PIN guide">
      <ScrollView style={{ maxHeight: 500 }}>
        {CARRIER_GUIDE.map((c) => (
          <View key={c.carrier} style={{ marginBottom: 16 }}>
            <Text weight="semibold">{c.carrier}</Text>
            {c.steps.map((s, idx) => (
              <Text key={idx} variant="caption" tone="dim" style={{ marginTop: 4 }}>{idx + 1}. {s}</Text>
            ))}
            {c.tip && <Text variant="caption" tone="brand" style={{ marginTop: 6, fontStyle: 'italic' }}>💡 {c.tip}</Text>}
          </View>
        ))}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stepRow:            { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 4 },
  stepTab:            { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  stepTabActive:      { backgroundColor: colors.brand + '22', borderWidth: 1, borderColor: colors.brand },
  stepperRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  stepperBtn:         { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox:           { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn:         { backgroundColor: colors.brand, borderColor: colors.brand },
  discountRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  discountRowSelected:{ backgroundColor: colors.brand + '11', borderColor: colors.brand },
  radio:              { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioOn:            { backgroundColor: colors.brand, borderColor: colors.brand },
  warnBox:            { marginTop: 10, padding: 10, backgroundColor: colors.warning + '22', borderColor: colors.warning + '66', borderWidth: 1, borderRadius: 8 },
  portInBox:          { marginTop: 12, padding: 12, backgroundColor: '#a855f711', borderColor: '#a855f7', borderWidth: 1, borderRadius: 10, gap: 6 },
  summaryLine:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
