import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, AppState, type AppStateStatus } from 'react-native';
import { Modal, Button, Text } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

const IDLE_MS    = 20 * 60 * 1000; // 20 minutes
const WARNING_MS = 60 * 1000;       // show warning 1 minute before sign-out
const WARN_AT_MS = IDLE_MS - WARNING_MS;

/**
 * Wraps children in an invisible touch listener. After 19 minutes of no
 * touches, shows a warning modal counting down 60s. If untouched, signs
 * the user out. Parity with the web's app/components/IdleTimeout.tsx.
 */
export function IdleTimeout({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current)    clearTimeout(idleTimer.current);
    if (warnTimer.current)    clearTimeout(warnTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);

    warnTimer.current = setTimeout(() => {
      setWarningOpen(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, WARN_AT_MS);

    idleTimer.current = setTimeout(() => {
      signOut();
    }, IDLE_MS);
  }, [clearTimers, signOut]);

  // Start when session arrives; clear when signed out.
  useEffect(() => {
    if (!session) {
      clearTimers();
      setWarningOpen(false);
      return;
    }
    startTimers();
    return clearTimers;
  }, [session, startTimers, clearTimers]);

  // Reset timer when the app comes back to foreground.
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') startTimers();
    });
    return () => sub.remove();
  }, [session, startTimers]);

  function onTouchAnywhere() {
    if (warningOpen) return;
    startTimers();
  }

  return (
    <View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { onTouchAnywhere(); return false; }}>
      {children}
      <Modal visible={warningOpen} onClose={() => { /* keep modal up until user picks */ }} title="Still there?" presentation="center">
        <Text tone="dim" style={{ marginBottom: 16 }}>
          You'll be signed out due to inactivity in{' '}
          <Text weight="bold">{countdown}s</Text>.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Sign out" onPress={() => signOut()} variant="secondary" fullWidth={false} style={{ flex: 1 }} />
          <Button title="Stay signed in" onPress={startTimers} variant="primary" fullWidth={false} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}
