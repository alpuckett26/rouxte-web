import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { trainingApi } from '@/api/training';
import { Screen, Text, Card, Button, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TrainingModule'>;

export default function TrainingModuleScreen({ route, navigation }: Props) {
  const { moduleId } = route.params;
  const q = useQuery({ queryKey: ['training-doc', moduleId], queryFn: () => trainingApi.doc(moduleId) });

  if (q.isLoading) {
    return (
      <Screen>
        <Skeleton height={28} width="60%" style={{ marginBottom: 16 }} />
        <Skeleton height={200} borderRadius={12} />
      </Screen>
    );
  }

  if (q.error || !q.data) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <Text tone="danger">Failed to load module.</Text>
        </Card>
      </Screen>
    );
  }

  const doc = q.data.data;
  const progress = q.data.progress;
  const passed = progress?.quiz_passed === true;
  const attempts = progress?.quiz_attempts ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text variant="title" weight="bold">{doc.title}</Text>
            {attempts > 0 && (
              <Text variant="caption" tone="dim" style={{ marginTop: 4 }}>
                {attempts} quiz attempt{attempts === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          {passed && <Badge label="Passed" color="green" dot />}
        </View>

        <Card style={{ marginTop: 16 }}>
          {doc.content ? (
            <Text style={{ lineHeight: 22 }}>{doc.content}</Text>
          ) : (
            <Text tone="dim">This module has no content yet.</Text>
          )}
        </Card>

        <Text variant="caption" tone="mute" style={{ marginTop: 12, textAlign: 'center' }}>
          Read through the material, then take the quiz. You need 80% or better to pass.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={passed ? 'Retake Quiz' : 'Take Quiz'}
          onPress={() => navigation.navigate('TrainingQuiz', { moduleId })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 12, paddingBottom: 24,
    backgroundColor: colors.bg + 'f0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
