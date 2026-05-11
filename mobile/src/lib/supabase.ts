import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import { config } from './config';

/**
 * Supabase session storage backed by react-native-keychain so the JWT is held
 * in the iOS Keychain / Android Keystore rather than plaintext AsyncStorage.
 */
const keychainStorage: SupportedStorage = {
  async getItem(key) {
    const creds = await Keychain.getGenericPassword({ service: key });
    return creds ? creds.password : null;
  },
  async setItem(key, value) {
    await Keychain.setGenericPassword(key, value, { service: key });
  },
  async removeItem(key) {
    await Keychain.resetGenericPassword({ service: key });
  },
};

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    storage: keychainStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Returns the current access token, or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
