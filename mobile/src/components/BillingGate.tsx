import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { supabase } from '@/lib/supabase';

/**
 * Wraps the authenticated mobile app. While the subscription is healthy
 * (trialing / active / past_due) it renders children. When the org has no
 * subscription or has been suspended/canceled it renders a full-screen
 * blocker.
 *
 * Billing posture — App Store / Play B2B exemption (Apple Guideline 3.1.3(c),
 * Google's enterprise carve-out):
 *
 *   Rouxte is sold to organizations for their reps, so it qualifies for the
 *   exemption from mandatory in-app purchase. To keep that exemption clean,
 *   the app hosts NO purchasing UI of any kind — no prices, no "subscribe /
 *   start trial" action, no in-app checkout, and no link that steers the user
 *   into an external purchase flow. The org's subscription is created and
 *   managed entirely on the web (rouxte.com), which is the source of truth.
 *
 *   This blocker is therefore purely informational: it explains why access is
 *   paused and offers a "Check again" refetch (and Sign out). Admins are told,
 *   in plain text, that billing is managed on the web; reps are told to contact
 *   their admin. Neither role gets a tappable purchase/checkout path.
 */
export function BillingGate({ children }: { children: React.ReactNode }) {
  const { isLoading, sub, needsSignup, isSuspended, viewerIsAdmin, refetch } =
    useBillingStatus();

  if (isLoading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator color="#1BAEE1" />
      </View>
    );
  }

  const blocked = needsSignup || isSuspended;
  if (!blocked) return <>{children}</>;

  const canceled = sub?.status === 'canceled';

  // Copy differs by role and state. No role gets a purchase/checkout CTA — the
  // app stays informational so the B2B in-app-purchase exemption holds.
  let title: string;
  let body: string;
  if (needsSignup) {
    title = 'Subscription inactive';
    body = viewerIsAdmin
      ? "Your organization doesn't have an active Rouxte subscription yet. It's managed on the web at rouxte.com — sign in there to set it up, then come back and tap Check again."
      : "Your team's Rouxte subscription isn't active yet. Ask your organization's admin to set it up, then tap Check again.";
  } else if (canceled) {
    title = 'Subscription canceled';
    body = viewerIsAdmin
      ? 'Your organization’s subscription was canceled. Manage it on the web at rouxte.com to restore access, then tap Check again.'
      : "Your team's subscription was canceled. Contact your organization's admin to restore access.";
  } else {
    // suspended / past due that has hardened into a block
    title = 'Subscription paused';
    body = viewerIsAdmin
      ? "There's a billing issue on your organization's account. Manage it on the web at rouxte.com to restore access, then tap Check again."
      : "There's a billing problem on your team's account. Contact your organization's admin.";
  }

  return (
    <View style={styles.blockerShell}>
      <View style={styles.blockerCard}>
        <Text style={styles.blockerTitle}>{title}</Text>
        <Text style={styles.blockerBody}>{body}</Text>

        <TouchableOpacity onPress={() => refetch()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Check again</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingShell: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F14' },
  blockerShell: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F14', padding: 24 },
  blockerCard: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: '#121821',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1f2733',
  },
  blockerTitle: { fontSize: 22, fontWeight: '700', color: '#F3F4F6', marginBottom: 10 },
  blockerBody: { fontSize: 14, color: '#9CA3AF', lineHeight: 21, marginBottom: 24 },
  primaryButton: { backgroundColor: '#1BAEE1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryButtonText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});
