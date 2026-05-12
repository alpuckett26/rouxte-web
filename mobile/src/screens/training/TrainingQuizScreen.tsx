import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, type QuizResult } from '@/api/training';
import { Screen, Text, Card, Button, Badge, Skeleton, ErrorBanner } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TrainingQuiz'>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function TrainingQuizScreen({ route, navigation }: Props) {
  const { moduleId } = route.params;
  const qc = useQueryClient();

  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  const quizQ = useQuery({
    queryKey: ['training-quiz', moduleId],
    queryFn:  () => trainingApi.quiz(moduleId),
    retry:    false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (quizQ.data?.questions && answers.length === 0) {
      setAnswers(new Array(quizQ.data.questions.length).fill(null));
    }
  }, [quizQ.data, answers.length]);

  const submit = useMutation({
    mutationFn: () => trainingApi.submitQuiz(
      moduleId,
      answers.map((a) => a ?? -1),
      quizQ.data!.variant,
    ),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ['training-modules'] });
      qc.invalidateQueries({ queryKey: ['training-doc', moduleId] });
    },
    onError: (e: Error) => Alert.alert('Submit failed', e.message),
  });

  if (quizQ.isLoading) {
    return (
      <Screen>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={100} borderRadius={12} style={{ marginBottom: 8 }} />
        ))}
      </Screen>
    );
  }

  if (quizQ.error) {
    return (
      <Screen>
        <ErrorBanner error={quizQ.error} context="quiz" />
        <Button title="Back" onPress={() => navigation.goBack()} variant="secondary" style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  if (!quizQ.data?.questions?.length) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <Text tone="dim">Quiz not available for this module yet.</Text>
        </Card>
        <Button title="Back" onPress={() => navigation.goBack()} variant="secondary" style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  // ── Result view ────────────────────────────────────────────────────────
  if (result) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={styles.resultHeader}>
          <Text variant="display" weight="bold" tone={result.passed ? 'success' : 'danger'}>
            {result.passed ? '✓ Passed!' : '✗ Not yet'}
          </Text>
          <Text variant="title" weight="bold" style={{ marginTop: 8 }}>
            {result.correct} / {result.total}
          </Text>
          <Text tone="dim" style={{ marginTop: 4 }}>
            {result.passed ? 'You passed this module.' : `Need ${result.pass_threshold}+ correct to pass.`}
          </Text>
        </View>

        <Text variant="caption" tone="dim" style={styles.section}>REVIEW</Text>
        {result.graded.map((q, i) => (
          <Card key={i} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text weight="semibold" style={{ flex: 1, marginRight: 8 }}>{i + 1}. {q.question}</Text>
              {q.is_correct
                ? <Badge label="Correct" color="green" />
                : <Badge label="Wrong" color="red" />}
            </View>
            {q.options.map((opt, oi) => (
              <View key={oi} style={[
                styles.reviewOpt,
                oi === q.correct && styles.reviewCorrect,
                oi === q.user_answer && oi !== q.correct && styles.reviewWrong,
              ]}>
                <Text variant="caption" weight={oi === q.correct ? 'semibold' : 'normal'}>
                  {OPTION_LABELS[oi]}. {opt}
                  {oi === q.correct && '  ✓'}
                  {oi === q.user_answer && oi !== q.correct && '  ← your answer'}
                </Text>
              </View>
            ))}
            {q.explanation && (
              <Text variant="caption" tone="brand" style={{ marginTop: 6, fontStyle: 'italic' }}>
                💡 {q.explanation}
              </Text>
            )}
          </Card>
        ))}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="Back to modules" onPress={() => navigation.popToTop()} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
          {!result.passed && (
            <Button
              title="Retry"
              onPress={() => { setResult(null); setAnswers([]); quizQ.refetch(); }}
              fullWidth={false}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // ── Quiz view ──────────────────────────────────────────────────────────
  const questions = quizQ.data.questions;
  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answers.length === questions.length && answeredCount === questions.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <Text variant="title" weight="bold">Quiz</Text>
        <Text variant="caption" tone="dim">
          Pass with {questions.length === 5 ? '4/5' : '80%'} or better. {answeredCount} of {questions.length} answered.
        </Text>

        {questions.map((q, qi) => (
          <Card key={qi} style={{ marginTop: 14 }}>
            <Text weight="semibold" style={{ marginBottom: 8 }}>
              {qi + 1}. {q.question}
            </Text>
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              return (
                <Pressable
                  key={oi}
                  onPress={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <View style={[styles.optBadge, selected && styles.optBadgeSelected]}>
                    <Text variant="caption" weight="bold" style={{ color: selected ? '#fff' : colors.textDim }}>
                      {OPTION_LABELS[oi]}
                    </Text>
                  </View>
                  <Text style={{ flex: 1 }}>{opt}</Text>
                </Pressable>
              );
            })}
          </Card>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={submit.isPending ? 'Submitting…' : `Submit (${answeredCount} / ${questions.length})`}
          onPress={() => submit.mutate()}
          loading={submit.isPending}
          disabled={!allAnswered}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resultHeader:    { alignItems: 'center', padding: 24 },
  section:         { marginTop: 8, marginBottom: 8, letterSpacing: 0.6 },
  option:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  optionSelected:  { borderColor: colors.brand, backgroundColor: colors.brand + '11' },
  optBadge:        { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgInput },
  optBadgeSelected:{ backgroundColor: colors.brand },
  reviewOpt:       { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginVertical: 2 },
  reviewCorrect:   { backgroundColor: colors.success + '22', borderLeftColor: colors.success, borderLeftWidth: 3 },
  reviewWrong:     { backgroundColor: colors.danger + '22', borderLeftColor: colors.danger, borderLeftWidth: 3 },
  footer:          {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 12, paddingBottom: 24,
    backgroundColor: colors.bg + 'f0',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
