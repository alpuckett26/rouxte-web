import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBillingStatus } from '@/hooks/useBillingStatus';

/**
 * Small status bar shown above the dashboard while trialing or past_due.
 *
 * Informational only — it surfaces the state of the org's subscription but
 * does NOT link out to a billing/checkout page. Steering the user toward an
 * external purchase mechanism would jeopardize the B2B in-app-purchase
 * exemption (see BillingGate). Billing is managed on the web; the app just
 * reports status.
 */
export function TrialBanner() {
  const { sub } = useBillingStatus();
  if (!sub) return null;

  if (sub.status === 'past_due') {
    return (
      <View style={[styles.bar, styles.pastDue]}>
        <Text style={styles.barTextWhite}>
          Payment issue on your team’s account — managed at rouxte.com.
        </Text>
      </View>
    );
  }

  if (!sub.is_in_trial) return null;

  const urgent = sub.days_left <= 5;
  return (
    <View style={[styles.bar, urgent ? styles.urgent : styles.normal]}>
      <Text style={[styles.barText, urgent ? { color: '#92400e' } : { color: '#1e40af' }]}>
        {sub.days_left === 0
          ? 'Last day of your free trial.'
          : sub.days_left === 1
          ? '1 day left in your free trial.'
          : `${sub.days_left} days left in your free trial.`}
      </Text>
    </View>
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
  barTextWhite: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
});
