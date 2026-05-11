import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet, ViewStyle, View } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  onPress: () => void;
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  onPress, title, variant = 'primary', loading, disabled, style, fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle(variant),
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.brand} />
      ) : (
        <View style={styles.row}>
          <Text weight="semibold" tone={variant === 'primary' || variant === 'danger' ? 'default' : 'brand'} style={textColor(variant)}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function variantStyle(v: Variant): ViewStyle {
  switch (v) {
    case 'primary':   return { backgroundColor: colors.brand };
    case 'secondary': return { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border };
    case 'danger':    return { backgroundColor: colors.danger };
    case 'ghost':     return { backgroundColor: 'transparent' };
  }
}

function textColor(v: Variant) {
  return { color: v === 'primary' ? '#fff' : v === 'danger' ? '#fff' : colors.brand };
}

const styles = StyleSheet.create({
  base:      { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  fullWidth: { alignSelf: 'stretch' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled:  { opacity: 0.5 },
  pressed:   { opacity: 0.85 },
});
