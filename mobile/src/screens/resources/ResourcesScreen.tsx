import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Linking, Pressable, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { resourcesApi, type OrgDocument } from '@/api/resources';
import { Screen, Text, Card, Input, Badge, Skeleton } from '@/components/ui';
import { colors } from '@/lib/colors';

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function fileTypeLabel(mime: string | null, name: string): string {
  if (mime?.includes('pdf') || name.toLowerCase().endsWith('.pdf')) return 'PDF';
  if (mime?.startsWith('image/')) return 'Image';
  if (mime?.includes('spreadsheet') || /\.(xlsx|xls|csv)$/i.test(name)) return 'Sheet';
  if (mime?.includes('document') || /\.(doc|docx)$/i.test(name)) return 'Doc';
  return 'File';
}

export default function ResourcesScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const q = useQuery({ queryKey: ['resources'], queryFn: resourcesApi.list });
  const docs = q.data?.documents ?? [];

  const categories = useMemo(() => {
    const cats = new Set<string>();
    docs.forEach((d) => { if (d.category) cats.add(d.category); });
    return ['all', ...Array.from(cats).sort()];
  }, [docs]);

  const filtered = docs.filter((d) => {
    if (category !== 'all' && d.category !== category) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) &&
        !(d.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Screen scrollable={false}>
      <Text variant="title" weight="bold">Resource Library</Text>
      <Text variant="caption" tone="dim">{docs.length} document{docs.length === 1 ? '' : 's'} · org-shared</Text>

      <Input value={search} onChangeText={setSearch} placeholder="Search…" style={{ marginTop: 12 }} />

      {categories.length > 1 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c}
          contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 8 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}>
              <Text variant="caption" tone={category === item ? 'default' : 'dim'}>
                {item === 'all' ? 'All' : item}
              </Text>
            </Pressable>
          )}
        />
      )}

      {q.isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={64} borderRadius={10} style={{ marginBottom: 6 }} />)
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', marginTop: 16 }}>
              <Text tone="dim">{docs.length === 0 ? 'No documents uploaded yet.' : 'No matches.'}</Text>
              {docs.length === 0 && (
                <Text variant="caption" tone="mute" style={{ marginTop: 4, textAlign: 'center' }}>
                  Managers upload promo sheets, forms, and PDFs on the web.
                </Text>
              )}
            </Card>
          }
          renderItem={({ item }) => <DocRow doc={item} />}
        />
      )}
    </Screen>
  );
}

function DocRow({ doc }: { doc: OrgDocument }) {
  return (
    <Pressable
      onPress={() => doc.url && Linking.openURL(doc.url)}
      disabled={!doc.url}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Card style={{ marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{doc.name}</Text>
            {doc.description && <Text variant="caption" tone="dim" style={{ marginTop: 2 }}>{doc.description}</Text>}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge label={fileTypeLabel(doc.mime_type, doc.name)} color="gray" />
              {doc.category && <Badge label={doc.category} color="blue" />}
              {doc.file_size && (
                <Text variant="caption" tone="mute">{formatSize(doc.file_size)}</Text>
              )}
            </View>
          </View>
          <Text tone="brand">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand + '22', borderColor: colors.brand },
});
