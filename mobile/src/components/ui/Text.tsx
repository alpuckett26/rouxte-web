import React from 'react';
import { Text as RNText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { colors } from '@/lib/colors';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'mono';
type Weight = 'normal' | 'medium' | 'semibold' | 'bold';
type Tone = 'default' | 'dim' | 'mute' | 'brand' | 'success' | 'warning' | 'danger';

interface Props extends TextProps {
  variant?: Variant;
  weight?: Weight;
  tone?: Tone;
}

export function Text({ variant = 'body', weight, tone = 'default', style, ...rest }: Props) {
  const base = variantStyles[variant];
  const weightStyle = weight ? weightStyles[weight] : null;
  const toneStyle = toneStyles[tone];
  return <RNText {...rest} style={[base, weightStyle, toneStyle, style]} />;
}

const variantStyles: Record<Variant, TextStyle> = StyleSheet.create({
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title:   { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body:    { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 16 },
  mono:    { fontSize: 13, lineHeight: 18, fontFamily: 'Menlo' },
});

const weightStyles: Record<Weight, TextStyle> = StyleSheet.create({
  normal:   { fontWeight: '400' },
  medium:   { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold:     { fontWeight: '700' },
});

const toneStyles: Record<Tone, TextStyle> = StyleSheet.create({
  default: { color: colors.text },
  dim:     { color: colors.textDim },
  mute:    { color: colors.textMute },
  brand:   { color: colors.brand },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger:  { color: colors.danger },
});
