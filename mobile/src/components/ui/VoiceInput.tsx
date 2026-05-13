import React from 'react';
import { Input } from './Input';
import type { TextInputProps } from 'react-native';

interface Props extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?: string;
  error?: string | null;
  value: string;
  onChangeText: (next: string) => void;
}

/**
 * In-app speech-to-text is on hold until Expo SDK adds RN 0.85 support
 * (then we'll swap to expo-speech-recognition). The previous backend
 * `@react-native-voice/voice@3.2.4` ships a 2020-era build.gradle that
 * references the removed jcenter() repo and omits compileSdk, breaking
 * the Android build under Gradle 8 + AGP 8.
 *
 * VoiceInput stays in the component vocabulary as a pass-through to
 * regular <Input> so call sites don't churn. Reps can still dictate via
 * their keyboard's built-in mic (Gboard, Samsung Keyboard, iOS keyboard
 * all have one).
 *
 * When Expo SDK 55+ lands with RN 0.85 support, swap this body to use
 * expo-speech-recognition's hooks; the call sites won't change.
 */
export function VoiceInput(props: Props) {
  return <Input {...props} />;
}
