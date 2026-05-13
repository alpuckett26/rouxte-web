import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/lib/colors';
import { offlineQueue } from '@/lib/offlineQueue';

/**
 * Small "Syncing N…" chip surfaced when the offline write queue has items.
 * Hidden when the queue is empty. Mount once globally — currently in the
 * map's top bar; we can promote to the global header later if needed.
 */
export function SyncBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    return offlineQueue.onChange(setCount);
  }, []);

  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <ActivityIndicator size="small" color={colors.brand} />
      <Text variant="caption" weight="semibold" tone="brand">Syncing {count}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard + 'ee',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
