import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { Screen, Text, Button, Card } from '@/components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'LeadPull'>;

export default function LeadPullScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => leadsApi.pull(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (data.data) navigation.replace('LeadDetail', { leadId: data.data.id });
      else Alert.alert('No leads available', 'The pool is empty — try again later.');
    },
    onError: (e: Error) => Alert.alert('Could not pull lead', e.message),
  });

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text variant="title" weight="bold">Pull from pool</Text>
        <Text tone="dim" style={{ marginTop: 8 }}>
          You'll get one lead from the unassigned pool. Auto-expires if you don't engage within the
          cooldown window.
        </Text>
        <Card style={{ marginTop: 18 }}>
          <Text variant="caption" tone="dim">RULES</Text>
          <Text style={{ marginTop: 4 }}>• One lead at a time</Text>
          <Text>• 48-hour engagement clock</Text>
          <Text>• Auto-released back to pool if no contact attempt</Text>
        </Card>
        <Button title="Pull next lead" onPress={() => m.mutate()} loading={m.isPending} style={{ marginTop: 24 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16 },
});
