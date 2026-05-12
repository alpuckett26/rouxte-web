import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/lib/colors';

interface Props {
  zoom: number;
}

function levelHint(z: number): string {
  if (z < 10) return 'Region';
  if (z < 12) return 'City';
  if (z < 14) return 'Hex fiber cells';
  if (z < 16) return 'Address dots';
  return 'Street-level';
}

/**
 * Translucent zoom-level chip that fades in while the zoom is changing,
 * then fades out after 1500ms of no activity. Placed top-right of the map.
 */
export function ZoomMeter({ zoom }: Props) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastZoomRef = useRef(zoom);

  useEffect(() => {
    // First mount — don't pop the meter
    if (lastZoomRef.current === zoom) return;
    lastZoomRef.current = zoom;

    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => setVisible(false));
    }, 1500);

    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [zoom, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.meter, { opacity }]} pointerEvents="none">
      <Text variant="caption" weight="bold" style={styles.zoomNum}>z {zoom.toFixed(1)}</Text>
      <Text variant="caption" tone="dim" style={styles.hint}>{levelHint(zoom)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  meter: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.bgCard + 'ee',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    minWidth: 64,
  },
  zoomNum: { color: colors.brand, fontSize: 13 },
  hint:    { fontSize: 9, marginTop: 1 },
});
