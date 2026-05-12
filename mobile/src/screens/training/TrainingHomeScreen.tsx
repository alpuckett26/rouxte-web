import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { trainingApi, type TrainingModuleSummary } from '@/api/training';
import { Screen, Text, Card, Skeleton, Badge } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<MoreStackParamList, 'Training'>;

export default function TrainingHomeScreen() {
  const nav = useNavigation<Nav>();
  const q = useQuery({ queryKey: ['training-modules'], queryFn: trainingApi.progress });

  if (q.isLoading) {
    return (
      <Screen>
        <Text variant="title" weight="bold">Field Training</Text>
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={72} borderRadius={12} style={{ marginBottom: 6 }} />
          ))}
        </View>
      </Screen>
    );
  }

  const modules = q.data?.data ?? [];
  const completed = q.data?.completed ?? 0;
  const total = q.data?.total ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allComplete = total > 0 && completed === total;

  function isUnlocked(idx: number): boolean {
    if (idx === 0) return true;
    return modules[idx - 1]?.progress?.quiz_passed === true;
  }

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Field Training Program</Text>
      <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>
        Read each module, score 80%+ on the quiz, and unlock the next. Pass everything to become promotion eligible.
      </Text>

      {/* Progress card */}
      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text variant="caption" tone="dim" weight="medium">OVERALL PROGRESS</Text>
          <Text weight="bold" tone="brand">{completed} of {total} passed</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        {allComplete && (
          <Text tone="success" weight="semibold" style={{ marginTop: 10 }}>
            ✓ Training complete — you are now promotion eligible
          </Text>
        )}
      </Card>

      {/* Module list */}
      <View style={{ marginTop: 14, gap: 6 }}>
        {modules.length === 0 ? (
          <Card style={{ alignItems: 'center' }}>
            <Text tone="dim">No training modules yet.</Text>
            <Text variant="caption" tone="mute" style={{ marginTop: 4, textAlign: 'center' }}>
              Managers upload docs to training_documents on the web.
            </Text>
          </Card>
        ) : (
          modules.map((mod, idx) => (
            <ModuleRow
              key={mod.id}
              module={mod}
              index={idx}
              unlocked={isUnlocked(idx)}
              onPress={() => nav.navigate('TrainingModule', { moduleId: mod.id })}
            />
          ))
        )}
      </View>

      <View style={{ marginTop: 16, gap: 4 }}>
        <Text variant="caption" tone="mute">⬜ Locked   🔵 Ready to start   ✅ Passed</Text>
      </View>
    </Screen>
  );
}

function ModuleRow({
  module: mod, index, unlocked, onPress,
}: { module: TrainingModuleSummary; index: number; unlocked: boolean; onPress: () => void }) {
  const passed = mod.progress?.quiz_passed === true;
  const started = !!mod.progress?.started_at;
  const attempts = mod.progress?.quiz_attempts ?? 0;

  const subtitle = passed
    ? `Completed · ${attempts} attempt${attempts === 1 ? '' : 's'}`
    : started
    ? 'In progress — quiz not yet passed'
    : unlocked
    ? 'Ready to start'
    : 'Complete the previous module first';

  return (
    <Pressable
      onPress={unlocked ? onPress : undefined}
      disabled={!unlocked}
      style={({ pressed }) => [pressed && unlocked && { opacity: 0.7 }]}
    >
      <Card style={[
        styles.moduleRow,
        passed && styles.modulePassed,
        unlocked && !passed && styles.moduleActive,
        !unlocked && styles.moduleLocked,
      ]}>
        <View style={[
          styles.stepCircle,
          passed ? styles.stepPassed : unlocked ? styles.stepActive : styles.stepLocked,
        ]}>
          <Text weight="bold" style={{ color: passed || unlocked ? '#fff' : colors.textMute }}>
            {passed ? '✓' : unlocked ? index + 1 : '🔒'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text weight="semibold" tone={passed ? 'mute' : unlocked ? 'default' : 'mute'} numberOfLines={1}>
            {mod.title}
          </Text>
          <Text variant="caption" tone={passed ? 'mute' : unlocked ? 'brand' : 'mute'}>
            {subtitle}
          </Text>
        </View>

        {passed && <Badge label="Passed" color="green" />}
        {unlocked && !passed && <Text tone="brand">›</Text>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track:        { height: 8, backgroundColor: colors.bgInput, borderRadius: 4, overflow: 'hidden' },
  fill:         { height: 8, backgroundColor: colors.brand, borderRadius: 4 },
  moduleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 },
  moduleActive: { borderColor: colors.brand, backgroundColor: colors.brand + '11' },
  modulePassed: { opacity: 0.7 },
  moduleLocked: { opacity: 0.4 },
  stepCircle:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepActive:   { backgroundColor: colors.brand },
  stepPassed:   { backgroundColor: colors.success },
  stepLocked:   { backgroundColor: colors.bgInput },
});
