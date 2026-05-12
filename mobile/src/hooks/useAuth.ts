import { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Session, User } from '@supabase/supabase-js';
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, user, loading, signIn, signInWithOAuth, signOut };
}
