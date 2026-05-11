import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '@/api/training';
import { Text, Card, Button } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TrainingQuiz'>;

export default function TrainingQuizScreen({ route, navigation }: Props) {
  const { moduleId } = route.params;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['training-quiz', moduleId],
    queryFn:  () => trainingApi.quiz(moduleId),
    retry: 0,
  });

  const questions = q.data?.questions ?? [];
  const variantId = q.data?.variant_id ?? '';
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ passed: boolean; score: number; correct_count: number } | null>(null);

  const submit = useMutation({
    mutationFn: () => trainingApi.submitQuiz(moduleId, questions.map((_, i) => answers[i] ?? -1), variantId),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ['training'] });
    },
    onError: (e: Error) => Alert.alert('Submit failed', e.message),
  });

  const allAnswered = useMemo(
    () => questions.length > 0 && questions.every((_, i) => typeof answers[i] === 'number'),
    [questions, answers],
  );

  if (q.error) {
    return (
      <View style={styles.center}>
        <Text tone="warning">Quiz not available right now.</Text>
        <Button title="Back" onPress={() => navigation.goBack()} variant="secondary" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (result) {
    return (
      <View style={styles.center}>
        <Text variant="display" tone={result.passed ? 'success' : 'danger'} weight="bold">
          {result.passed ? '✓ Passed' : '✗ Failed'}
        </Text>
        <Text variant="title" weight="semibold" style={{ marginTop: 12 }}>{Math.round(result.score)}%</Text>
        <Text tone="dim" style={{ marginTop: 4 }}>{result.correct_count} / {questions.length} correct</Text>
        <Button title="Back to modules" onPress={() => navigation.popToTop()} style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text variant="title" weight="bold">Quiz</Text>
      <Text tone="dim" style={{ marginTop: 4 }}>Pass with 80% or better.</Text>

      {questions.map((qst, i) => (
        <Card key={qst.id} style={{ marginTop: 14 }}>
          <Text weight="semibold" style={{ marginBottom: 8 }}>
            {i + 1}. {qst.text}
          </Text>
          {qst.options.map((opt, oi) => {
            const selected = answers[i] === oi;
            return (
              <Pressable
                key={oi}
                onPress={() => setAnswers((prev) => ({ ...prev, [i]: oi }))}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioOn]} />
                <Text style={{ flex: 1 }}>{opt}</Text>
              </Pressable>
            );
          })}
        </Card>
      ))}

      <Button
        title="Submit answers"
        onPress={() => submit.mutate()}
        loading={submit.isPending}
        disabled={!allAnswered}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 16 },
  option:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  optionSelected: { },
  radio:          { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioOn:        { backgroundColor: colors.brand, borderColor: colors.brand },
});
