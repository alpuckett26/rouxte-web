import React from 'react';
import { ScrollView, View, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/lib/colors';

interface Props {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  padded?: boolean;
}

export function Screen({ children, scrollable = true, refreshing, onRefresh, loading, padded = true }: Props) {
  const content = loading ? (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  ) : (
    children
  );

  if (!scrollable) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.flex, padded && styles.padded]}>{content}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
          ) : undefined
        }
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  flex:          { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded:        { padding: 16 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
