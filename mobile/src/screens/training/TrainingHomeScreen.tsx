import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { trainingApi } from '@/api/training';
import { Screen, Text, Card } from '@/components/ui';
import { colors } from '@/lib/colors';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '@/types';

type Props = NativeStackScreenProps<MoreStackParamList, 'Training'>;

export default function TrainingHomeScreen({ navigation }: Props) {
  const q = useQuery({ queryKey: ['training'], queryFn: trainingApi.list });

  const progressByModule = new Map((q.data?.progress ?? []).map((p) => [p.module_id, p]));

  return (
    <Screen
      loading={q.isLoading}
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold" style={{ marginBottom: 12 }}>Training</Text>
      {(q.data?.modules ?? []).map((m) => {
        const p = progressByModule.get(m.id);
        const locked = p?.status === 'locked';
        const completed = p?.status === 'completed';
        return (
          <Card
            key={m.id}
            onPress={() => !locked && navigation.navigate('TrainingModule', { moduleId: m.id })}
            style={{
              marginBottom: 8,
              opacity: locked ? 0.5 : 1,
              borderColor: completed ? colors.success : colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text weight="semibold" style={{ flex: 1 }}>{m.title}</Text>
              {completed && <Text tone="success" variant="caption">✓ Complete</Text>}
              {locked && <Text tone="mute" variant="caption">Locked</Text>}
            </View>
            {m.description && <Text tone="dim" variant="caption">{m.description}</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}
