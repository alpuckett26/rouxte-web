import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/lib/colors';

interface Props {
  knocks: number;
  appts: number;
  sales: number;
  dnks: number;
}

/**
 * Slim today-at-a-glance strip for Field Mode. Matches the chip-row aesthetic
 * (rounded pill, semi-transparent card background) so it stacks naturally
 * under the lead/layer chips.
 */
export function StatsBar({ knocks, appts, sales, dnks }: Props) {
  return (
    <View style={styles.bar}>
      <Stat label="Knocks" value={knocks} tone="default" />
      <Divider />
      <Stat label="Appts" value={appts} tone="info" />
      <Divider />
      <Stat label="Sales" value={sales} tone="success" />
      <Divider />
      <Stat label="DNK" value={dnks} tone="danger" />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'default' | 'info' | 'success' | 'danger' }) {
  const color =
    tone === 'info'    ? colors.info :
    tone === 'success' ? colors.success :
    tone === 'danger'  ? colors.danger :
    colors.text;
  return (
    <View style={styles.stat}>
      <Text variant="caption" weight="bold" style={{ color }}>{value}</Text>
      <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard + 'e6',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stat:    { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  label:   { fontSize: 10 },
  divider: { width: 1, height: 12, backgroundColor: colors.border },
});
