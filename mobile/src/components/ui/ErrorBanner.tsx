import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/colors';
import { ApiError } from '@/api/client';

interface Props {
  error: unknown;
  onRetry?: () => void;
  context?: string;
}

export function ErrorBanner({ error, onRetry, context }: Props) {
  if (!error) return null;

  const isApi = error instanceof ApiError;
  const status = isApi ? error.status : null;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="danger" weight="semibold">
        {status ? `HTTP ${status}` : 'Error'}{context ? ` · ${context}` : ''}
      </Text>
      <Text variant="caption" tone="danger" style={{ marginTop: 4 }} numberOfLines={3}>
        {message}
      </Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
          <Text variant="caption" weight="semibold" tone="danger">Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   {
    backgroundColor: '#ef444411',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  retry:  { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.danger + '22' },
});
