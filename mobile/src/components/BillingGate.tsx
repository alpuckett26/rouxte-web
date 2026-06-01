import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

/**
 * Wraps the authenticated mobile app. While the subscription is healthy
 * (trialing / active / past_due) it renders children. When the org has no
 * subscription or has been suspended/canceled it renders a full-screen
 * blocker.
 *
 * Role matters: only org admins can act on billing (the web /billing flow is
 * the source of truth — Square's Web Payments SDK has no React Native
 * equivalent). Sales reps can't subscribe, so they NEVER see a purchase CTA —
 * they're told to contact their admin. This also keeps a sales rep's first
 * screen free of any "buy / start trial" external-purchase prompt, which is
 * the most common App Store / Play rejection trigger.
 *
 * Admins manage billing inside an in-app WebView (not an external browser),
 * authenticated via the /billing/bridge page, so they stay in the app and
 * land back here when done.
 */
export function BillingGate({ children }: { children: React.ReactNode }) {
  const { isLoading, sub, needsSignup, isSuspended, viewerIsAdmin, refetch } =
    useBillingStatus();
  const [billingUrl, setBillingUrl] = useState<string | null>(null);

  async function openWebBilling(path: '/billing' | '/billing/bridge' = '/billing/bridge') {
    const base = config.api.baseUrl.replace(/\/$/, '');
    if (path === '/billing/bridge') {
      // Pass the session into the WebView so the cookie-authed web page opens
      // already logged in instead of bouncing to the login screen.
      const { data } = await supabase.auth.getSession();
      const at = data.session?.access_token;
      const rt = data.session?.refresh_token;
      if (at && rt) {
        setBillingUrl(`${base}/billing/bridge#access_token=${at}&refresh_token=${rt}`);
        return;
      }
    }
    setBillingUrl(`${base}${path}`);
  }

  function closeWebBilling() {
    setBillingUrl(null);
    // They may have just subscribed / updated billing — re-check so the gate
    // lifts without a full app restart.
    refetch();
  }

  if (isLoading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator color="#1BAEE1" />
      </View>
    );
  }

  const blocked = needsSignup || isSuspended;

  if (blocked) {
    const canceled = sub?.status === 'canceled';
    const suspended = sub?.status === 'suspended';

    // Copy + actions differ by role. Reps get no purchase/manage CTA.
    let title: string;
    let body: string;
    if (needsSignup) {
      title = viewerIsAdmin ? 'Subscribe to use Rouxte' : 'Subscription inactive';
      body = viewerIsAdmin
        ? "Your organization doesn't have an active subscription yet. Start your 30-day free trial — it takes about a minute."
        : "Your team's Rouxte subscription isn't active yet. Ask your organization's admin to start it, then pull to refresh.";
    } else if (canceled) {
      title = 'Subscription canceled';
      body = viewerIsAdmin
        ? 'Your subscription was canceled. Re-subscribe to restore access for your team.'
        : "Your team's subscription was canceled. Contact your organization's admin to restore access.";
    } else {
      // suspended / past due
      title = 'Subscription suspended';
      body = viewerIsAdmin
        ? "We couldn't charge your card. Update billing to restore access."
        : "There's a billing problem on your team's account. Contact your organization's admin.";
    }

    const cta = needsSignup ? 'Start free trial' : 'Manage billing';

    return (
      <>
        <View style={styles.blockerShell}>
          <View style={styles.blockerCard}>
            <Text style={styles.blockerTitle}>{title}</Text>
            <Text style={styles.blockerBody}>{body}</Text>

            {viewerIsAdmin ? (
              <TouchableOpacity onPress={() => openWebBilling('/billing/bridge')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{cta} →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => refetch()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Check again</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <BillingWebViewModal url={billingUrl} onClose={closeWebBilling} />
      </>
    );
  }

  return <>{children}</>;
}

/** In-app browser for the web billing flow. */
function BillingWebViewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalShell}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Billing</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.modalClose}>Done</Text>
          </TouchableOpacity>
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webLoading}>
                <ActivityIndicator color="#1BAEE1" />
              </View>
            )}
            // The bridge sets the session client-side; allow that to run.
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
          />
        ) : null}
      </SafeAreaView>
    </Modal>
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
  modalShell: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 16, fontWeight: '600', color: '#1BAEE1' },
  webLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
