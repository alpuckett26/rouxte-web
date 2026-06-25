# Google Play — App setup field answers (Rouxte)

Fill-in sheet for **Play Console → Dashboard → "Set up your app"** and the
**Main store listing**. Answers are kept consistent with the public privacy
policy (`https://rouxte.com/privacy`) and `REVIEW_NOTES.md`. Update all three
together if anything changes.

Package: `com.rouxte.app` · App category: **Business** · Default language: **English (US)**

---

## URLs (used in several places)

| Field | Value |
|---|---|
| Privacy policy | `https://rouxte.com/privacy` |
| Account deletion (Data safety) | `https://rouxte.com/delete-account` |
| Support email | `support@rouxte.com` |
| Privacy contact | `privacy@rouxte.com` |
| Website | `https://rouxte.com` |

---

## Main store listing

**App name** (30 chars max): `Rouxte`

**Short description** (80 chars max):
```
Field sales platform for door-to-door fiber & wireless dealer teams.
```

**Full description** (4000 chars max):
```
Rouxte is the all-in-one field-sales platform for door-to-door fiber and
wireless dealer organizations. It is a B2B tool for sales teams — reps, team
leads, and managers join an organization their administrator has already set
up. Rouxte is not a consumer app and is not used to sign up for service.

For sales reps
• See assigned leads on a live territory map and drop new ones at the door
• Check AT&T fiber availability at an address before you knock
• Log every door, note, and status change — your activity, in one place
• Build fiber and wireless quotes and send them to the customer
• Train with built-in courses and quizzes
• Ask "Rex," the AI sales coach, for rebuttals and competitor intel
• Track your sales, standing, and commissions

For managers and admins
• Assign and bulk-assign leads, review submitted sales, run the manager queue
• Monitor team activity, compensation, and payroll
• Run in-app video meetings with the team

Access requires an organization account. Subscriptions are arranged by the
organization off-app; there is no in-app purchasing. The in-app store sells
physical branded merchandise only.

Questions: support@rouxte.com
```

**Graphics** (have/generate):
- App icon — 512 × 512 PNG (32-bit, with alpha)
- Feature graphic — 1024 × 500 PNG/JPG
- Phone screenshots — ≥ 2 (16:9 or 9:16), generator in repo (`mobile/store-assets`)
- (Optional) 7" / 10" tablet screenshots if declaring tablet support

**Contact details:** email `support@rouxte.com` (phone/website optional)

---

## App access

Rouxte is **login-gated** → choose **"All or some functionality is restricted."**
Add one instruction set so the reviewer can sign in:

- **Name:** Full app (org admin)
- **Username:** `demo-admin@rouxte-pro.test`
- **Password:** `rouxte-demo`
- **Instructions:**
  ```
  Rouxte is a B2B app; users join an existing organization. Sign in from the
  login screen with the email + password above (or use Sign in with Google /
  email). This demo account is an org admin on a fully-seeded showcase org with
  an active subscription, so every feature is visible with no gate.
  ```
> Prerequisite: this account must exist and be loginable on the **production**
> Supabase the release build points at. Verify before submitting.

---

## Ads

**No**, this app does not contain ads.

---

## Content rating (IARC questionnaire)

- **Category:** Utility, Productivity, Communication, or Other (not a game)
- Violence / sexual content / profanity / controlled substances / gambling / horror: **No** to all
- **Users can interact / communicate:** **Yes** — in-app video meetings (Daily.co) and AI chat between members of the same organization
- **Users can share their location with other users:** **Yes** — a rep's field location is visible to their managers within the same org (core feature)
- Shares user-provided content publicly: **No** (content is scoped to the org; nothing is public)
- Digital purchases: physical goods only (see Financial features)

Expected result: **Everyone / PEGI 3**. Answer truthfully — the comms + location
questions don't raise the rating for a business tool, but mis-declaring them is a
policy risk.

---

## Target audience and content

- **Target age group:** **18 and over only** (workplace tool; do not select any
  under-18 bracket)
- **Appeals to children:** **No**
- This keeps the app out of the Families policy program.

---

## Other declarations (App content)

| Section | Answer |
|---|---|
| News app | No |
| COVID-19 contact tracing/status | No |
| Government app | No |
| Health apps | No |
| **Financial features** | The in-app **Store** sells **physical merchandise** (badges, swag) via Square (card data tokenized by Square, never stored by Rouxte). No loans, no crypto, no in-app financial-product features. B2B subscriptions are sold **off-app** to organizations. |
| Data safety | See below |

---

## Data safety (must match the privacy policy)

> Google's definition of **"Sharing"** = transferring data to a *third party*.
> Transfers to **service providers that process on your behalf do NOT count as
> sharing.** All of Rouxte's vendors (Supabase, Vercel, Mapbox, Anthropic,
> Resend, Square, Sentry, Printful, Daily.co, FCM/APNs) are processors → answer
> **"No, we don't share user data with third parties."** Visibility of a rep's
> activity to their own org is a product feature, not third-party sharing.

**Does your app collect or share user data?** Yes (collect), No (share).

**Encryption in transit:** Yes.
**Can users request deletion?** Yes — provide `https://rouxte.com/delete-account`
(and note in-app Settings → Delete account).

**Data collected** (all *linked to the user*; none used for ads/marketing; none
sold). Mark **purpose** as "App functionality" unless noted; add "Analytics"
where noted:

| Data type | Collected | Optional/Required | Notes / purpose |
|---|---|---|---|
| Name | Yes | Required (rep) / Optional (prospect) | Account; lead capture |
| Email address | Yes | Required | Account management |
| Phone number | Yes | Optional | Lead/contact |
| User IDs | Yes | Required | Account management |
| Address | Yes | Required for a lead | Homeowner property addresses entered by reps |
| Approximate location | Yes | Optional | Map / territory |
| Precise location | Yes | Optional | Field-mode last-seen position |
| App interactions | Yes | Required | Activity logging; also **Analytics** |
| Crash logs | Yes | Required | Sentry — **Analytics** / diagnostics |
| Diagnostics | Yes | Required | Performance — **Analytics** |
| Device or other IDs | Yes | Required | FCM/APNs push token for notifications |
| Purchase history | Yes | Optional | In-app store orders (physical goods) |

> Do **not** declare "Payment info / Credit card number" — Square tokenizes it;
> Rouxte never receives raw card data.
>
> Do **not** declare "Photos" — the mobile app has no camera/image-picker and
> no photo-attach or document-upload flow (those are web-only; the onboarding
> Documents step explicitly defers to web). The profile `avatar_url` is a
> read-only display field set on the web, not collected by the app.

---

## Production release

- **Track:** Production (CI auto-uploads via fastlane once the SA has the
  "Release to production…" permission — see `project_mobile_ci_release` memory).
- **Countries/regions:** select target countries (e.g. United States) for the
  production track.
- **Release name / notes:** fastlane skips metadata/changelog upload, so set
  release notes in the console or leave default.
```
