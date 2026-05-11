import React, { useRef, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { aiApi, streamCoach } from '@/api/ai';
import { Text, Card, Input } from '@/components/ui';
import { colors } from '@/lib/colors';

type Mode = 'coach' | 'roleplay';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CoachChatScreen() {
  const usageQ = useQuery({ queryKey: ['ai-usage'], queryFn: aiApi.usage });
  const [mode, setMode] = useState<Mode>('coach');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setStreaming(true);

    let assistantText = '';
    const ac = new AbortController();
    abortRef.current = ac;

    setMessages([...next, { role: 'assistant', content: '' }]);

    try {
      await streamCoach(
        next,
        mode,
        (chunk) => {
          assistantText += chunk;
          setMessages([...next, { role: 'assistant', content: assistantText }]);
          scrollRef.current?.scrollToEnd({ animated: true });
        },
        ac.signal,
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages([...next, { role: 'assistant', content: `[error: ${(e as Error).message}]` }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={64}
    >
      <View style={styles.header}>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setMode('coach')} style={[styles.modeChip, mode === 'coach' && styles.modeChipActive]}>
            <Text variant="caption" tone={mode === 'coach' ? 'default' : 'dim'}>Coach (Rex)</Text>
          </Pressable>
          <Pressable onPress={() => setMode('roleplay')} style={[styles.modeChip, mode === 'roleplay' && styles.modeChipActive]}>
            <Text variant="caption" tone={mode === 'roleplay' ? 'default' : 'dim'}>Roleplay</Text>
          </Pressable>
        </View>
        {usageQ.data && (
          <Text variant="caption" tone="mute">{usageQ.data.prompts_used}/3 today</Text>
        )}
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.list}>
        {messages.map((m, i) => (
          <Card
            key={i}
            style={[
              styles.bubble,
              m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text>{m.content || '…'}</Text>
          </Card>
        ))}
        {streaming && <ActivityIndicator color={colors.brand} style={{ marginVertical: 12 }} />}
      </ScrollView>

      <View style={styles.composer}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={mode === 'coach' ? 'Ask Rex anything…' : 'Roleplay as homeowner…'}
          multiline
          style={{ flex: 1, marginBottom: 0 }}
        />
        <Pressable
          onPress={send}
          disabled={streaming || !input.trim()}
          style={[styles.send, (streaming || !input.trim()) && { opacity: 0.5 }]}
        >
          <Text weight="semibold">{streaming ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: colors.bg },
  header:           { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeRow:          { flexDirection: 'row', gap: 6 },
  modeChip:         { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  modeChipActive:   { backgroundColor: colors.brand + '22', borderColor: colors.brand },
  list:             { padding: 16, paddingBottom: 16 },
  bubble:           { marginBottom: 8, maxWidth: '85%' },
  bubbleUser:       { alignSelf: 'flex-end',  backgroundColor: colors.brand + '22', borderColor: colors.brand },
  bubbleAssistant:  { alignSelf: 'flex-start' },
  composer:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgElev },
  send:             { backgroundColor: colors.brand, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
