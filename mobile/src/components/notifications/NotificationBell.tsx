import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors } from '@/lib/colors';
import { useNotifications } from '@/hooks/useNotifications';

interface Props {
  onPress: () => void;
}

export function NotificationBell({ onPress }: Props) {
  const { unread } = useNotifications();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.wrap}>
      <Text variant="heading">🔔</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text variant="caption" weight="bold" style={styles.badgeText}>
            {unread > 99 ? '99+' : String(unread)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap:      { padding: 4 },
  badge:     {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12 },
});
