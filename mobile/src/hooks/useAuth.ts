import { useState, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Session, User } from '@supabase/supabase-js';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { supabase } from '@/lib/supabase';

const AUTH_REDIRECT_URL = 'rouxteapp://auth-callback';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('[auth] state change:', event, 'session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) qc.clear();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [qc]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signInWithOAuth(provider: 'google' | 'github') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });
    if (error) return error;
    if (data?.url) {
      await Linking.openURL(data.url);
    }
    return null;
  }

  /**
   * Sign in with Apple — iOS only. Uses the native Apple Sign In sheet,
   * exchanges the resulting identity token with Supabase via signInWithIdToken.
   *
   * Apple Review Guideline 4.8 requires this on iOS if the app offers other
   * third-party social sign-in (Google, GitHub).
   *
   * Requires Supabase Apple provider to be enabled (Dashboard → Auth →
   * Providers → Apple) with the Services ID, Team ID, Key ID, and .p8 secret.
   */
  async function signInWithApple() {
    if (Platform.OS !== 'ios') {
      return new Error('Apple sign-in is only available on iOS');
    }
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      const { identityToken } = response;
      if (!identityToken) {
        return new Error('Apple did not return an identity token');
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });
      return error;
    } catch (e: unknown) {
      if (e instanceof Error) return e;
      return new Error('Apple sign-in failed');
    }
  }

  /**
   * Defensive sign-out — always clears local state, even if the network
   * call to invalidate the refresh token on Supabase's auth server fails.
   *
   * Using scope='local' so we don't depend on a network round-trip to
   * sign out on this device. The Supabase token entry in Keychain is
   * removed by supabase-js as part of this call.
   */
  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      if (__DEV__) console.warn('[signout] supabase signOut threw:', e);
    }
    // Belt-and-suspenders: force local state clear even if the listener
    // didn't fire (seen in some Supabase JS versions on RN).
    setSession(null);
    setUser(null);
    qc.clear();
  }

  return { session, user, loading, signIn, signInWithOAuth, signInWithApple, signOut };
}
