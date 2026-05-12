import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TextInput, TextInputProps, View, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-voice/voice';
import { Text } from './Text';
import { colors } from '@/lib/colors';

interface Props extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?: string;
  error?: string | null;
  value: string;
  onChangeText: (next: string) => void;
}

/**
 * <Input>-shaped field with a microphone button on the right. Tap mic to
 * start dictation; tap again to stop. Final transcript is APPENDED to the
 * existing value (so a partial typed note is preserved). Interim transcripts
 * are shown in dim text below the field while recording.
 *
 * Uses @react-native-voice/voice — required RECORD_AUDIO on Android (already
 * in AndroidManifest) and NSMicrophoneUsageDescription +
 * NSSpeechRecognitionUsageDescription on iOS (already in Info.plist).
 */
export function VoiceInput({ label, error, value, onChangeText, style, multiline, ...rest }: Props) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const valueAtStartRef = useRef('');

  // Wire native event handlers. Voice exposes a singleton so cleanup on
  // unmount is important — without it a stale onResults can fire into a
  // dead component.
  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0];
      if (!text) return;
      const base = valueAtStartRef.current;
      const next = base ? `${base.trimEnd()} ${text}`.trim() : text;
      onChangeText(next);
      setInterim('');
    };
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0];
      if (text) setInterim(text);
    };
    Voice.onSpeechEnd = () => {
      setListening(false);
      setInterim('');
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setListening(false);
      setInterim('');
      const msg = e.error?.message ?? 'Voice unavailable';
      // Common: "5/Client side error" right after stop() — silent
      if (msg.includes('Client side error')) return;
      Alert.alert('Voice error', msg);
    };
    return () => {
      Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
    };
  }, [onChangeText]);

  const start = useCallback(async () => {
    valueAtStartRef.current = value;
    setInterim('');
    try {
      await Voice.start('en-US');
      setListening(true);
    } catch (e) {
      Alert.alert('Voice unavailable', (e as Error).message);
    }
  }, [value]);

  const stop = useCallback(async () => {
    try { await Voice.stop(); } catch { /* silent */ }
    setListening(false);
  }, []);

  return (
    <View style={styles.wrap}>
      {label && <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <TextInput
          placeholderTextColor={colors.textMute}
          {...rest}
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
          style={[styles.input, !!error && styles.inputError, style]}
        />
        <Pressable
          onPress={listening ? stop : start}
          style={[styles.mic, listening && styles.micActive]}
          hitSlop={8}
        >
          {listening
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.micIcon}>🎤</Text>}
        </Pressable>
      </View>
      {listening && !!interim && (
        <Text variant="caption" tone="dim" style={styles.interim}>{interim}…</Text>
      )}
      {error && <Text variant="caption" tone="danger" style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { marginBottom: 14 },
  label:      { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  row:        { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  input:      {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  mic:        {
    width: 48,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive:  { backgroundColor: colors.danger, borderColor: colors.danger },
  micIcon:    { fontSize: 18 },
  interim:    { marginTop: 6, fontStyle: 'italic' },
  errorText:  { marginTop: 4 },
});
