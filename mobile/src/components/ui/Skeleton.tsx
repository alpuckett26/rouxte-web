import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/lib/colors';

interface Props {
  height?: number;
  width?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ height = 16, width = '100%', borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { height, width: width as number | `${number}%`, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Convenience: a horizontal stack of skeleton boxes. */
export function SkeletonGrid({ count = 4, height = 80 }: { count?: number; height?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexBasis: '47%', flexGrow: 1 }}>
          <Skeleton height={height} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.bgCard },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
