import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/colors';

export type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

interface Props {
  label: string;
  color?: BadgeColor;
  dot?: boolean;
  style?: ViewStyle;
}

// Colors mirror web's bg-{color}-100 text-{color}-700 but adapted for the dark theme.
const palettes: Record<BadgeColor, { bg: string; fg: string }> = {
  gray:   { bg: '#37415133', fg: '#94a3b8' },
  blue:   { bg: '#3b82f633', fg: '#60a5fa' },
  green:  { bg: '#22c55e33', fg: '#4ade80' },
  yellow: { bg: '#eab30833', fg: '#facc15' },
  red:    { bg: '#ef444433', fg: '#f87171' },
  purple: { bg: '#a855f733', fg: '#c084fc' },
  orange: { bg: '#f9731633', fg: '#fb923c' },
};

export function Badge({ label, color = 'gray', dot = false, style }: Props) {
  const palette = palettes[color];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: palette.fg }]} />}
      <Text variant="caption" weight="medium" style={{ color: palette.fg }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

// Re-export colors so consumers don't need a second import.
export { colors };
