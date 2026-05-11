import React, { useState } from 'react';
import { Pressable, View, StyleSheet, FlatList } from 'react-native';
import { Modal } from './Modal';
import { Text } from './Text';
import { colors } from '@/lib/colors';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label && <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.field, disabled && styles.disabled]}
      >
        <Text tone={selected ? 'default' : 'mute'}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text tone="dim">▾</Text>
      </Pressable>

      <Modal visible={open} onClose={() => setOpen(false)} title={label ?? 'Select'}>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onChange(item.value); setOpen(false); }}
              style={styles.option}
            >
              <Text weight={item.value === value ? 'semibold' : 'normal'}>
                {item.label}
              </Text>
              {item.value === value && <Text tone="brand">✓</Text>}
            </Pressable>
          )}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { marginBottom: 14 },
  label:    { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  field:    {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  option:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  sep:      { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
