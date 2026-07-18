# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Web
npm run dev      # start Next.js dev server (port 3000)
npm run build    # production build
npm run lint     # ESLint

# Mobile (run from mobile/)
cd mobile
npm install
npx pod-install ios               # iOS only — pulls CocoaPods deps
npm run android                   # build + run on Android emulator/device
npm run ios                       # build + run on iOS simulator
npm start                         # Metro bundler only
```

There is no test suite — verify behavior by running the dev server (web) or `npm run android` / `npm run ios` (mobile).

## Architecture

**Web stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Supabase · Mapbox GL 3 · Anthropic SDK · Square · Resend
**Mobile stack:** React Native 0.85 · React Navigation v7 · Supabase JS · TanStack Query · `@rnmapbox/maps` · React Native Firebase

### Workspace layout

- `app/` — Next.js pages and API routes (no `src/` wrapper)
- `app/api/` — ~97 Next.js route handlers, one folder per resource
- `app/components/` — client components grouped by domain (`map/`, `leads/`, `manager/`, `dashboard/`, `ai/`, `onboarding/`, `payroll/`, `training/`, `quotes/`, `smartpitch/`, `notifications/`, `store/`, `resources/`, `card/`, `meetings/`, `ui/`)
- `lib/supabase/` — three web Supabase clients + the universal API client (see below)
- `lib/types/index.ts` — all shared TypeScript types/interfaces (also re-exported by mobile)
- `lib/hooks/useProfile.ts` — the single hook for current user identity (web)
- `lib/quoting/` — server-only fiber + wireless quote pricing engines
- `lib/email/` — Resend templates + send helpers
- `supabase/migrations/` — numbered SQL migrations `000`–`037`
- `mobile/` — React Native workspace (separate package.json; excluded from Next.js tsc)

### Supabase client pattern

Four clients, each for a different context:

| File | Use when |
|---|---|
| `lib/supabase/server.ts` | Server Components and Server-Side Pages (cookie-only) |
| `lib/supabase/api.ts` | **/api/* route handlers** — accepts cookie *or* `Authorization: Bearer <jwt>` (mobile) |
| `lib/supabase/client.ts` | Client Components (`"use client"`) — singleton |
| `lib/supabase/admin.ts` | Bypass RLS (service role key, server-only) |

All API routes auth-check with `supabase.auth.getUser()` first. RLS on Postgres handles org-level scoping automatically — every table has `org_id`. Only use `createAdminClient()` when you need to write to a row the current user's RLS policy would block (e.g., seeding org data during invite acceptance).

**Mobile auth:** the React Native app obtains a session JWT via the Supabase JS client and sends `Authorization: Bearer <jwt>` on every `/api/*` call. `lib/supabase/api.ts` validates this transparently — route handlers don't need to know whether the caller is web or mobile.

### Auth & routing

Next.js 16 currently uses `middleware.ts` at the repo root. **Note:** Next.js 16.1+ deprecates `middleware.ts` in favor of `proxy.ts` — the build warns but still works. Renaming is a future cleanup. `middleware.ts` delegates to `lib/supabase/middleware.ts` which refreshes the session and redirects unauthenticated requests away from protected routes. Public paths: `/auth`, `/o/`, `/optout`, `/invite`, `/offline`, `/r/`, `/api/`, `/`.

Onboarding gate: after login, web users hit `/onboarding/check` which reads `onboarding_step` and redirects through the sequence: `confirmed → promo → profile → documents → dashboard`. Admins skip the `documents` step. The mobile app mirrors this flow in `mobile/src/screens/onboarding/`.

### Role hierarchy

```
admin > sales_manager > team_lead > sales_rep
```

`isManager` always includes `team_lead` — they get map Select Area, manager queue lite (`/manager/team`), and AI rate-limit exemptions. Only `admin` and `sales_manager` get the full manager suite (`/manager/queue`, compensation, payroll management, etc.).

Current user identity comes from `useProfile()` (`lib/hooks/useProfile.ts`) — it fetches `/api/me` once and caches at module scope. The mobile equivalent is `mobile/src/hooks/useAuth.ts`.

### AppShell (web)

`app/components/AppShell.tsx` wraps all authenticated pages. It has two layout modes:
- **Normal mode** — scrollable page, fixed bottom mobile nav
- **`mapMode`** — full `h-dvh` flex column, in-flow (non-fixed) mobile nav so the map fills the precise remaining height

Wrap map pages with `<AppShell mapMode>`.

### Map (Mapbox GL — web)

`app/components/map/MapboxMap.tsx` is the core map component. Leads are rendered as a GeoJSON source (`leads-source`) with a circle layer using a Mapbox `match` expression keyed on `status`. `STATUS_HEX` maps each `LeadStatus` to a color — update both together if statuses change.

Select Area (bulk-assign) uses a canvas overlay for drag-rectangle selection then `queryRenderedFeatures` to find leads inside the bounds. Gated to `canBulkAssign` (all roles except `sales_rep`).

FCC coverage data lives in `fcc_att_locations` and `fcc_att_blocks` tables — queried via `/api/fcc/coverage` and `/api/fcc/blocks`. Coverage fetch is gated to zoom ≥ 11.

### Mobile workspace

`mobile/` is a bare React Native project (not Expo). Native projects:
- iOS: `mobile/ios/RouxteApp.xcodeproj` (Swift AppDelegate, CocoaPods)
- Android: `mobile/android/` (Kotlin MainActivity/MainApplication, Gradle)

Bundle IDs (subject to user confirmation): `com.rouxte.app` for both platforms.

Mobile is a thin client over the Next.js API routes. Architectural rules:
- All writes (`POST`/`PATCH`/`DELETE`) go through `/api/*` so business logic / side-effects / email sends are not duplicated on device.
- Reads that need realtime (notifications bell, lead live updates) may use the Supabase JS client directly, since RLS already enforces scoping.
- Shared TypeScript types live in `lib/types/index.ts` and are re-exported by `mobile/src/types/index.ts` via a path alias.

### Sales Logger

`sales_activity_log` is **append-only** — a DB trigger blocks UPDATE and DELETE. Corrections are made by inserting a new row with `amends_log_id` pointing to the original. `isIncident()` in `lib/utils/logs.ts` determines whether an event sets `is_incident = true`.

Compliance events (`no_solicit_observed`, `do_not_knock_marked`, `complaint_received`, `law_enforcement_contact`, `trespass_warning`) automatically set `is_incident = true`.

### AI Coach

`/api/ai/chat` streams responses from Anthropic (`claude-sonnet-4-6`). Knowledge is built per-request from two tables: `competitor_intel` (shared global + org-specific) and `coach_qa` (org-specific scripts/rebuttals). Sales reps are rate-limited to 50 prompts/day; managers/admins are exempt. The AI persona is "Rex" in coach mode; homeowner roleplay in roleplay mode.

### Quotes

Fiber and wireless quote builders live under `app/components/quotes/`. Pricing engines are server-only (`lib/quoting/`). Quotes are stored in `quotes` + `quote_lines` tables. Customer emails (with PDF attachment for fiber, plain-text body for wireless) are sent via Resend.

### SmartPitch funnel

`/r/[slug]` is a public, rep-owned lead-capture funnel. The quiz is scored to a `lead_temperature` (hot/warm/cold) with a `recommended_pitch`. Submissions appear in `funnel_submissions` and feed the rep's SmartPitch dashboard.

### Notifications

`notifications` table is the source of truth. Bell badge counts unread rows. Some events also send email (Resend). Realtime is via Supabase channels. Mobile receives the same events plus push notifications (FCM Android / APNs iOS).

### Store + payments

Rouxte-branded merch (badges, swag) — designed in-app, checked out via Square (replaced Stripe in commit `949d8d4`), fulfilled by Printful. Webhook signature verification lives in `app/api/store/webhook/route.ts`.

### Meetings

In-app video via Daily.co. Room provisioning + tokens via `/api/meetings/*`.

### Anseur (Answers) pipeline sync

Rouxte is the sales layer for the Anseur flagship (repo `alpuckett26/restaurant-ai-ordering`; internal/technical name stays "answers" — only rep-facing copy says Anseur). Leads join on `leads.external_ref` = Answers `restaurant_id` with `external_source = 'answers'` (migration 038). `/api/cron/answers-sync` (every 15 min, `CRON_SECRET`) pulls `GET /admin/restaurants/pipeline` and upserts leads — Answers wins on status only while a lead is still `new`; reps are authoritative after that. The spine also PUSHES each newly sourced lead to `POST /api/answers/load` (the lead-drop rail, `X-Answers-Secret` = `ANSWERS_BUILD_SECRET`); `POST /api/answers/backfill?since=<iso>` (Bearer `CRON_SECRET`) is a one-shot idempotent loader from `GET /internal/provision/leads`. All three share the upsert rules in `lib/answers/upsertLead.ts`; the cron reconciles any push the rail misses. Status changes in `PATCH /api/leads/[id]` push back (`sold → onboarding`, `interested/appointment → pitched`) via `lib/answers/client.ts`, best-effort with cron reconciliation. Contract: `PIPELINE-ROLES.md` in the Answers repo.

### Data model key points

- `leads.carrier_availability` — JSONB: `{ att: bool, competitors: string[], max_down_mbps, max_up_mbps, tech_codes, fcc_block_id }`
- `user_profiles.total_sales_count` / `graduated_at` — auto-incremented on `sale_submitted` log events; graduation threshold is 10 sales
- `sales_activity_log.amends_log_id` — self-referential FK for corrections
- `lead_funnels` (SmartPitch) — one row per rep, generates `funnel_submissions`
- All timestamps are `timestamptz`; client-side dates go through `.toISOString()`

### Environment variables

**Required everywhere:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server-only, never expose to client
```

**Web app:**
```
NEXT_PUBLIC_MAPBOX_TOKEN       # public-scope Mapbox token for web map style
NEXT_PUBLIC_APP_URL            # canonical app URL, e.g. https://rouxte.com
NEXT_PUBLIC_SITE_URL           # canonical site URL (often same as APP_URL)
ANTHROPIC_API_KEY              # AI Coach (Rex)
RESEND_API_KEY                 # transactional email
RESEND_FROM                    # e.g. "Rouxte <noreply@rouxte.com>"
DAILY_API_KEY                  # Daily.co meetings
CRON_SECRET                    # cron route auth (/api/cron/lead-expiry, /api/cron/answers-sync, …)
ANSWERS_API_URL                # Anseur (Answers) flagship API base URL — lead pipeline sync
ANSWERS_INTERNAL_SECRET        # X-Internal-Secret service lane for Answers API (preferred)
ANSWERS_BUILD_SECRET           # inbound X-Answers-Secret auth on /api/answers/load (push rail)
ANSWERS_ADMIN_TOKEN            # fallback: admin JWT for Answers API (until service lane exists)
ANSWERS_TARGET_ORG_ID          # Rouxte org that receives synced Answers leads
MAPBOX_GEOCODE_TOKEN           # optional: server-side geocoding token (falls back to NEXT_PUBLIC_MAPBOX_TOKEN)
SQUARE_ACCESS_TOKEN            # Square store payments
SQUARE_ENVIRONMENT             # "production" | "sandbox"
SQUARE_LOCATION_ID
SQUARE_WEBHOOK_SIGNATURE_KEY   # Square webhook HMAC verification
PRINTFUL_API_KEY               # store fulfillment
PRINTFUL_VARIANT_BADGE_25      # optional, defaults 443893
PRINTFUL_VARIANT_BADGE_5       # optional, defaults 443892
PRINTFUL_VARIANT_BADGE_1       # optional, defaults 443891
FCC_USERNAME                   # FCC BDC sync scripts
FCC_API_TOKEN
SEED_ORG_ID                    # local seed scripts only
```

**Mobile app** (`mobile/.env.development` and `mobile/.env.production`, loaded by `react-native-config`):
```
SUPABASE_URL                   # same value as NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY              # same value as NEXT_PUBLIC_SUPABASE_ANON_KEY
API_BASE_URL                   # https://rouxte.com (or staging URL)
MAPBOX_TOKEN                   # public Mapbox token
SENTRY_DSN                     # mobile crash reporting
```

**Mobile build-time** (in `~/.netrc` and CI secrets, NOT in .env):
```
MAPBOX_DOWNLOADS_TOKEN         # secret-scope Mapbox token for CocoaPods/Gradle SDK download
SENTRY_AUTH_TOKEN              # source map upload
MATCH_PASSWORD                 # fastlane match (iOS certs)
APP_STORE_CONNECT_API_KEY      # TestFlight uploads
KEYSTORE_PASSWORD              # Android signing
PLAY_SERVICE_ACCOUNT_JSON      # Play Internal Track uploads
```

### Mobile dev quick start

```bash
cd mobile
cp .env.example .env.development
# fill in SUPABASE_URL, SUPABASE_ANON_KEY, API_BASE_URL, MAPBOX_TOKEN
npm install
npx pod-install ios            # macOS only
npm run ios                    # or npm run android
```

## Your role in the Anseur stack

Read `PIPELINE-ROLES.md` in this repo FIRST — it is your standing role
card: who's in the group, your duties, and the trigger that starts your
work. The canonical cross-repo contract lives in
`alpuckett26/restaurant-ai-ordering` → `PIPELINE-ROLES.md`; coordination
between repos happens via GitHub issues.
