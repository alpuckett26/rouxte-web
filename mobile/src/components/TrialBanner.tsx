import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { config } from '@/lib/config';

/**
 * Small bar shown above the dashboard. Visible while trialing or past_due.
 * Tapping it opens the web /billing page in the device browser.
 */
export function TrialBanner() {
  const { sub } = useBillingStatus();
  if (!sub) return null;

  function openBilling() {
    const url = `${config.api.baseUrl.replace(/\/$/, '')}/billing`;
    Linking.openURL(url).catch(() => {});
  }

  if (sub.status === 'past_due') {
    return (
      <TouchableOpacity onPress={openBilling} activeOpacity={0.85} style={[styles.bar, styles.pastDue]}>
        <Text style={styles.barTextWhite}>
          Payment failed — update billing to keep access.
        </Text>
        <Text style={styles.barCtaWhite}>Manage →</Text>
      </TouchableOpacity>
    );
  }

  if (!sub.is_in_trial) return null;

  const urgent = sub.days_left <= 5;
  return (
    <TouchableOpacity onPress={openBilling} activeOpacity={0.85}
      style={[styles.bar, urgent ? styles.urgent : styles.normal]}>
      <Text style={[styles.barText, urgent ? { color: '#92400e' } : { color: '#1e40af' }]}>
        {sub.days_left === 0
          ? 'Last day of your free trial.'
          : sub.days_left === 1
          ? '1 day left in your free trial.'
          : `${sub.days_left} days left in your free trial.`}
      </Text>
      <Text style={[styles.barCta, urgent ? { color: '#92400e' } : { color: '#1e40af' }]}>Manage →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  normal:   { backgroundColor: '#eff6ff', borderBottomColor: '#bfdbfe' },
  urgent:   { backgroundColor: '#fffbeb', borderBottomColor: '#fde68a' },
  pastDue:  { backgroundColor: '#dc2626', borderBottomColor: '#b91c1c' },
  barText:  { fontSize: 13, fontWeight: '500', flex: 1 },
  barCta:   { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  barTextWhite: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  barCtaWhite:  { fontSize: 13, fontWeight: '700', color: '#fff', marginLeft: 8 },
});
