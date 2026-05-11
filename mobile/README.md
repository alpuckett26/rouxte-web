# Rouxte Mobile

Bare React Native app for Rouxte. Talks to the Next.js API at `rouxte.com` for all writes; uses
Supabase directly only for auth + realtime reads.

## Quick start

```bash
# from repo root
cd mobile
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL, MAPBOX_TOKEN, SENTRY_DSN

npm install
npx pod-install ios        # iOS only (macOS)
npm run ios                # or npm run android
```

If `npx pod-install` complains about Mapbox, set `MAPBOX_DOWNLOADS_TOKEN` (a *secret-scope*
token from the Mapbox dashboard — NOT the public token in `.env`) in `~/.netrc`:

```
machine api.mapbox.com
  login mapbox
  password sk.YOUR_SECRET_TOKEN
```

## Architecture

See `CLAUDE.md` in the repo root.

- **`src/api/*`** — typed wrappers over the Next.js `/api/*` routes. All writes go here.
- **`src/lib/supabase.ts`** — Supabase JS client with Keychain-backed session storage.
- **`src/hooks/useAuth.ts`, `useProfile.ts`** — current user.
- **`src/screens/*`** — one folder per domain.
- **`src/navigation/*`** — root → auth | onboarding | main(tabs) gate.

## Beta builds

CI runs Fastlane on `mobile-v*` git tags:

```bash
git tag mobile-v0.1.0
git push origin mobile-v0.1.0
```

Required GitHub Actions secrets:

| Secret | What |
|---|---|
| `MATCH_GIT_URL`                  | Private repo holding iOS certs via `fastlane match` |
| `MATCH_PASSWORD`                 | Password protecting match certs |
| `APP_STORE_CONNECT_API_KEY_ID`   | API key ID |
| `APP_STORE_CONNECT_API_ISSUER`   | API issuer ID |
| `APP_STORE_CONNECT_API_KEY`      | base64 of the `.p8` API key file |
| `ANDROID_KEYSTORE_BASE64`        | base64 of the release `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD`      | Keystore password |
| `ANDROID_KEY_ALIAS`              | Signing key alias |
| `ANDROID_KEY_PASSWORD`           | Signing key password |
| `PLAY_SERVICE_ACCOUNT_JSON`      | Play Console service account JSON |
| `MAPBOX_DOWNLOADS_TOKEN`         | Mapbox secret-scope token (for SDK download) |
| `SENTRY_AUTH_TOKEN`              | Source map upload |

## Local Fastlane

```bash
cd mobile
bundle install
bundle exec fastlane ios beta
bundle exec fastlane android beta
```
