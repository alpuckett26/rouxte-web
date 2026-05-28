import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  API_BASE_URL,
  MAPBOX_TOKEN,
  SENTRY_DSN,
} from '@env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env and fill in values.',
  );
}

export const config = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },
  api: {
    baseUrl: API_BASE_URL ?? 'https://rouxte.com',
  },
  mapbox: {
    token: MAPBOX_TOKEN,
  },
  sentry: {
    dsn: SENTRY_DSN,
  },
} as const;
