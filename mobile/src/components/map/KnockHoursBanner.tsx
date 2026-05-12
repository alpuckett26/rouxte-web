import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/lib/colors';

const KNOCK_START_HOUR = 9;
const KNOCK_END_HOUR = 20; // 8pm — quiet hours begin at 20:00

function outsideHours(d: Date): boolean {
  const h = d.getHours();
  return h < KNOCK_START_HOUR || h >= KNOCK_END_HOUR;
}

/**
 * Yellow strip shown when local time is outside legal solicitation hours.
 * Hours hardcoded to 9am – 8pm (typical TX rule); make org-configurable later.
 * Re-checks every minute so the banner appears/disappears at the boundary.
 */
export function KnockHoursBanner() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!outsideHours(now)) return null;

  return (
    <View style={styles.banner}>
      <Text variant="caption" weight="semibold" style={styles.text}>
        ⚠ Outside legal knock hours ({KNOCK_START_HOUR}am – {KNOCK_END_HOUR - 12}pm local)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning + 'cc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  text: { color: '#1a1a1a' },
});
