import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '@/api/training';
import { Text, Card, Button } from '@/components/ui';
import { colors } from '@/lib/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'TrainingModule'>;

export default function TrainingModuleScreen({ route, navigation }: Props) {
  const { moduleId } = route.params;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['training', moduleId], queryFn: () => trainingApi.get(moduleId) });

  const startMutation = useMutation({
    mutationFn: () => trainingApi.setProgress(moduleId, 'in_progress'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  });

  React.useEffect(() => {
    if (q.data?.progress?.status === 'available') {
      startMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.progress?.status]);

  const module = q.data?.module;

  if (!module) {
    return (
      <View style={styles.center}>
        <Text tone="dim">{q.isLoading ? 'Loading…' : 'Module not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text variant="title" weight="bold">{module.title}</Text>
      {module.description && <Text tone="dim" style={{ marginTop: 6 }}>{module.description}</Text>}

      {module.content_md && (
        <Card style={{ marginTop: 18 }}>
          <Text style={{ lineHeight: 22 }}>{module.content_md}</Text>
        </Card>
      )}

      <Button
        title="Take quiz"
        onPress={() => navigation.navigate('TrainingQuiz', { moduleId })}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
