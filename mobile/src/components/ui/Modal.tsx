import React from 'react';
import { Modal as RNModal, View, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Full-height bottom sheet (default) or centered dialog. */
  presentation?: 'sheet' | 'center';
}

export function Modal({ visible, onClose, title, children, presentation = 'sheet' }: Props) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType={presentation === 'sheet' ? 'slide' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.kbWrap, presentation === 'sheet' ? styles.sheetAlign : styles.centerAlign]}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.surface,
              presentation === 'sheet' ? styles.sheet : styles.center,
            ]}
          >
            {title && (
              <View style={styles.header}>
                <Text variant="heading" weight="semibold">{title}</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text variant="heading" tone="dim">×</Text>
                </Pressable>
              </View>
            )}
            {children}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: '#00000099' },
  kbWrap:      { flex: 1 },
  sheetAlign:  { justifyContent: 'flex-end' },
  centerAlign: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  surface:     { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 },
  sheet:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  center:      { width: '100%', maxWidth: 420, borderRadius: 16, padding: 18 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
});
