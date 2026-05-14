import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { config } from '@/lib/config';

/**
 * Wraps the authenticated mobile app. While the subscription is healthy
 * (trialing / active / past_due), renders children. When the org has no
 * subscription or has been suspended/canceled, renders a full-screen
 * "Subscribe via web" blocker. The trial countdown banner is rendered
 * inside `TrialBanner` and consumed at the dashboard / screen level so
 * this component stays purely a blocker.
 */
export function BillingGate({ children }: { children: React.ReactNode }) {
  const { isLoading, sub, needsSignup, isSuspended } = useBillingStatus();

  if (isLoading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator />
      </View>
    );
  }

  if (needsSignup) {
    return (
      <BlockerScreen
        title="Subscribe to use Rouxte"
        body="You don't have an active subscription yet. Tap below to start your 30-day free trial on the web — it takes about a minute. Come back here when you're done."
        cta="Start free trial"
      />
    );
  }

  if (isSuspended) {
    return (
      <BlockerScreen
        title={sub?.status === 'canceled' ? 'Subscription canceled' : 'Subscription suspended'}
        body={
          sub?.status === 'canceled'
            ? "Your subscription was canceled. Re-subscribe on the web to come back."
            : "We couldn't charge your card. Update billing on the web to restore access."
        }
        cta="Manage billing"
      />
    );
  }

  return <>{children}</>;
}

function BlockerScreen({ title, body, cta }: { title: string; body: string; cta: string }) {
  function openWebBilling() {
    const url = `${config.api.baseUrl.replace(/\/$/, '')}/billing`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={styles.blockerShell}>
      <View style={styles.blockerCard}>
        <Text style={styles.blockerTitle}>{title}</Text>
        <Text style={styles.blockerBody}>{body}</Text>
        <TouchableOpacity onPress={openWebBilling} style={styles.blockerButton}>
          <Text style={styles.blockerButtonText}>{cta} →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingShell: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  blockerShell: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  blockerCard: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  blockerTitle:    { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 10 },
  blockerBody:     { fontSize: 14, color: '#4b5563', lineHeight: 21, marginBottom: 24 },
  blockerButton:   { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  blockerButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
