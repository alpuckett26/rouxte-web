import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/lib/colors';

interface Props {
  distanceMeters: number;
  compass: string;
  onPress: () => void;
}

const ARROW: Record<string, string> = {
  N: '↑', NE: '↗', E: '→', SE: '↘',
  S: '↓', SW: '↙', W: '←', NW: '↖',
};

/**
 * Compact "Next: 47 ft NE ↗" chip. Tap → camera flies to the nearest
 * unworked lead and opens its sheet.
 */
export function NextLeadChip({ distanceMeters, compass, onPress }: Props) {
  const distLabel = distanceMeters < 1000
    ? `${Math.round(distanceMeters * 3.28084 / 5) * 5} ft`
    : `${(distanceMeters / 1609.344).toFixed(1)} mi`;
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Text variant="caption" weight="semibold" tone="brand">
        Next  ·  {distLabel}  ·  {compass} {ARROW[compass] ?? ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.bgCard + 'e6',
    borderColor: colors.brand,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});
