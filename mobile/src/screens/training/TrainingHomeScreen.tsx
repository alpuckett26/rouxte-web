import React from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { trainingApi, type TrainingFile } from '@/api/training';
import { Screen, Text, Card, Skeleton } from '@/components/ui';

export default function TrainingHomeScreen() {
  const q = useQuery({ queryKey: ['training-sections'], queryFn: trainingApi.sections });

  if (q.isLoading) {
    return (
      <Screen>
        <Text variant="title" weight="bold">Training</Text>
        <View style={{ marginTop: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={56} borderRadius={10} style={{ marginBottom: 6 }} />
          ))}
        </View>
      </Screen>
    );
  }

  const sections = q.data?.data ?? [];
  const empty = sections.length === 0 || sections.every((s) => s.files.length === 0);

  return (
    <Screen
      refreshing={q.isFetching && !q.isLoading}
      onRefresh={() => q.refetch()}
    >
      <Text variant="title" weight="bold">Training</Text>
      <Text variant="caption" tone="dim">Pitch decks, rebuttal guides, contracts</Text>

      {empty ? (
        <Card style={{ marginTop: 16, alignItems: 'center' }}>
          <Text tone="dim">No training docs uploaded yet.</Text>
          <Text variant="caption" tone="mute" style={{ marginTop: 4, textAlign: 'center' }}>
            Managers upload docs to the training bucket on the web.
          </Text>
        </Card>
      ) : (
        sections.map((section) => (
          <View key={section.folder} style={{ marginTop: 16 }}>
            <Text variant="caption" tone="dim" style={styles.section}>{section.label.toUpperCase()}</Text>
            {section.files.length === 0 ? (
              <Card style={{ alignItems: 'center' }}>
                <Text tone="mute" variant="caption">No files in this folder.</Text>
              </Card>
            ) : (
              section.files.map((file) => <FileRow key={file.path} file={file} />)
            )}
          </View>
        ))
      )}
    </Screen>
  );
}

function FileRow({ file }: { file: TrainingFile }) {
  const friendly = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return (
    <Pressable
      onPress={() => file.url && Linking.openURL(file.url)}
      disabled={!file.url}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text weight="medium">{friendly}</Text>
          <Text variant="caption" tone="mute">{file.name}</Text>
        </View>
        <Text tone="brand">›</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 8, letterSpacing: 0.6 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
});
