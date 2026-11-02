import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Screen, Text, Input, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import {
  APPLIANCES,
  FUEL_LABELS,
  OUTAGE_OPTIONS,
  sizeBackup,
  type Appliance,
  type ApplianceId,
  type Fuel,
  type Recommendation,
} from '@/lib/backupSizing';

const GROUPS: { id: Appliance['group']; label: string }[] = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'comfort',    label: 'Comfort' },
  { id: 'heavy',      label: 'Heavy loads' },
];

const REC_LABELS: Record<Recommendation, string> = {
  generator: 'Standby generator',
  powerwall: 'Powerwall battery',
  hybrid:    'Battery + generator',
};

const STARTER: Partial<Record<ApplianceId, number>> = { fridge: 1, lights: 1, electronics: 1 };

export default function BackupSizingScreen() {
  const [loads, setLoads] = useState<Partial<Record<ApplianceId, number>>>(STARTER);
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [outageHours, setOutageHours] = useState<number>(24);
  const [solarKw, setSolarKw] = useState('');

  const result = useMemo(
    () => sizeBackup({ loads, fuel, outageHours, solarKw: Number(solarKw) || 0 }),
    [loads, fuel, outageHours, solarKw],
  );

  const setQty = (id: ApplianceId, qty: number) =>
    setLoads((prev) => ({ ...prev, [id]: Math.max(0, Math.min(9, qty)) }));

  const pw = result.powerwall;
  const expansions = pw.batteries - pw.powerwall3Units;

  return (
    <Screen>
      {/* Result first — it's what the rep shows the homeowner. */}
      <Card style={{ ...styles.card, ...styles.recCard }}>
        <Text variant="caption" tone="brand" weight="semibold">RECOMMENDED DIRECTION</Text>
        <Text variant="heading" weight="bold" style={{ marginTop: 4 }}>{REC_LABELS[result.recommendation]}</Text>
        {result.reasons.map((r) => (
          <Text key={r} variant="caption" tone="dim" style={{ marginTop: 4 }}>{r}</Text>
        ))}
      </Card>

      <Card style={styles.card}>
        <View style={styles.statRow}>
          <Stat label="Running load" value={`${result.runningKw} kW`} />
          <Stat label="Motor start" value={`${result.startingKw} kW`} />
        </View>
        <View style={[styles.statRow, { marginTop: 12 }]}>
          <Stat label="Energy / day" value={`${result.dailyKwh} kWh`} />
          <Stat label="Whole outage" value={`${result.outageKwh} kWh`} />
        </View>
      </Card>

      {result.generator && (
        <Card style={styles.card}>
          <Text weight="semibold">Generator</Text>
          <Text variant="heading" weight="bold" style={{ marginTop: 4 }}>{result.generator.model}</Text>
          <Text variant="caption" tone="mute">
            {result.generator.ratedKw} kW on {fuel === 'natural_gas' ? 'natural gas' : 'propane'}
            {fuel === 'none' ? ' (tank needed)' : ''}
            {!result.generator.fits ? ' · needs load management' : ''}
          </Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text weight="semibold">Powerwall 3</Text>
        <Text variant="heading" weight="bold" style={{ marginTop: 4 }}>
          {pw.batteries} {pw.batteries === 1 ? 'battery' : 'batteries'} · {(pw.batteries * 13.5).toFixed(1)} kWh
        </Text>
        <Text variant="caption" tone="mute">
          {pw.powerwall3Units} Powerwall 3{expansions > 0 ? ` + ${expansions} expansion` : ''}
          {!pw.fits ? ' · beyond a single system' : ''}
        </Text>
      </Card>

      <Text variant="caption" tone="mute" style={styles.disclaimer}>
        Assumes everything selected runs at once. Rules-of-thumb loads; not a quote or a load calculation.
      </Text>

      <Card style={styles.card}>
        <Text weight="semibold" style={styles.sectionLabel}>Longest outage to cover</Text>
        <View style={styles.chips}>
          {OUTAGE_OPTIONS.map((o) => (
            <Chip key={o.hours} label={o.label} active={outageHours === o.hours} onPress={() => setOutageHours(o.hours)} />
          ))}
        </View>

        <Text weight="semibold" style={[styles.sectionLabel, { marginTop: 16 }]}>Fuel at the home</Text>
        <View style={styles.chips}>
          {(Object.keys(FUEL_LABELS) as Fuel[]).map((f) => (
            <Chip key={f} label={FUEL_LABELS[f]} active={fuel === f} onPress={() => setFuel(f)} />
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Input
            label="Rooftop solar (kW, 0 if none)"
            value={solarKw}
            onChangeText={setSolarKw}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.id} style={styles.card}>
          <Text weight="semibold" style={styles.sectionLabel}>{g.label}</Text>
          {APPLIANCES.filter((a) => a.group === g.id).map((a) => {
            const qty = loads[a.id] ?? 0;
            return (
              <View key={a.id} style={styles.loadRow}>
                <View style={{ flex: 1 }}>
                  <Text weight={qty ? 'semibold' : 'normal'}>{a.label}</Text>
                  <Text variant="caption" tone="mute">
                    {(a.runningW / 1000).toFixed(1)} kW{a.startingW ? ` · ${(a.startingW / 1000).toFixed(1)} kW start` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setQty(a.id, qty - 1)}
                  disabled={!qty}
                  accessibilityLabel={`Remove ${a.label}`}
                  style={[styles.stepBtn, !qty && { opacity: 0.3 }]}
                >
                  <Text weight="bold">−</Text>
                </Pressable>
                <Text weight="semibold" style={styles.qty}>{qty}</Text>
                <Pressable
                  onPress={() => setQty(a.id, qty + 1)}
                  accessibilityLabel={`Add ${a.label}`}
                  style={styles.stepBtn}
                >
                  <Text weight="bold">+</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" tone="mute">{label}</Text>
      <Text weight="bold">{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" weight="semibold" tone={active ? 'brand' : 'dim'}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card:         { marginBottom: 12 },
  recCard:      { borderColor: colors.brand, borderWidth: 1 },
  statRow:      { flexDirection: 'row', gap: 12 },
  disclaimer:   { marginBottom: 12 },
  sectionLabel: { marginBottom: 8 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive:   { borderColor: colors.brand, backgroundColor: colors.bgElev },
  loadRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stepBtn:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qty:          { width: 18, textAlign: 'center' },
});
