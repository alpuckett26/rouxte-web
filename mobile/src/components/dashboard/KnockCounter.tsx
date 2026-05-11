import React from 'react';
import { Pressable, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors } from '@/lib/colors';
import { useKnockCounter } from '@/hooks/useKnockCounter';

interface Props {
  /** Optional lead context — knock will be associated with this lead. */
  leadId?: string | null;
  /** Pin to a different edge. Default bottom-right. */
  position?: 'bottom-right' | 'bottom-left';
  /** Extra bottom offset (e.g. push above tab bar) */
  bottomOffset?: number;
}

export function KnockCounter({ leadId, position = 'bottom-right', bottomOffset = 76 }: Props) {
  const { today, logKnock, loggingKnock } = useKnockCounter(leadId);

  return (
    <Pressable
      onPress={logKnock}
      style={({ pressed }) => [
        styles.fab,
        position === 'bottom-right' ? { right: 16 } : { left: 16 },
        { bottom: bottomOffset },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      {loggingKnock ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" weight="medium" style={{ color: '#fff' }}>KNOCKS</Text>
          <Text variant="title" weight="bold" style={{ color: '#fff', lineHeight: 26 }}>{today}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
