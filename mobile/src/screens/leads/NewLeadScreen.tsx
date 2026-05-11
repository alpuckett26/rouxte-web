import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/api/leads';
import { Screen, Text, Input, Button } from '@/components/ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LeadsStackParamList } from '@/types';

type Props = NativeStackScreenProps<LeadsStackParamList, 'NewLead'>;

export default function NewLeadScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [address, setAddress] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');

  const m = useMutation({
    mutationFn: () =>
      leadsApi.create({
        address,
        customer_name: customer || null,
        phone: phone || null,
        status: 'new',
        source: 'manual',
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      navigation.replace('LeadDetail', { leadId: res.data.id });
    },
    onError: (e: Error) => Alert.alert('Could not create lead', e.message),
  });

  return (
    <Screen>
      <Text variant="title" weight="bold" style={{ marginBottom: 16 }}>New Lead</Text>
      <Input
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="123 Main St, Houston TX 77002"
        autoComplete="street-address"
      />
      <Input
        label="Customer name"
        value={customer}
        onChangeText={setCustomer}
        autoComplete="name"
      />
      <Input
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <View style={{ marginTop: 12 }}>
        <Button title="Create lead" onPress={() => m.mutate()} loading={m.isPending} disabled={!address.trim()} />
      </View>
    </Screen>
  );
}
