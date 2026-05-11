import React from 'react';
import { TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/colors';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
}

export function Input({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label && (
        <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>
      )}
      <TextInput
        placeholderTextColor={colors.textMute}
        {...rest}
        style={[styles.input, !!error && styles.inputError, style]}
      />
      {error && <Text variant="caption" tone="danger" style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { marginBottom: 14 },
  label:      { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input:      {
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  errorText:  { marginTop: 4 },
});
