import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { STATUS_HEX } from '@/lib/colors';
import type { LeadStatus } from '@/types';

const STATUS_LABEL: Record<LeadStatus, string> = {
  new:         'New',
  attempted:   'Attempted',
  interested:  'Interested',
  appointment: 'Appointment',
  sold:        'Sold',
  lost:        'Lost',
};

export function StatusPill({ status }: { status: LeadStatus }) {
  const bg = STATUS_HEX[status] ?? '#64748b';
  return (
    <View style={[styles.pill, { backgroundColor: bg + '22', borderColor: bg }]}>
      <Text variant="caption" weight="semibold" style={{ color: bg }}>
        {STATUS_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
});
