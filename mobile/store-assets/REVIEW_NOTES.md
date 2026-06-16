# App Review Notes — Rouxte

Paste the relevant section into the store's reviewer-notes field:
- **Apple:** App Store Connect → your version → *App Review Information → Notes*
- **Google:** Play Console → *App content / Policy → "How your app works"* and the testing-instructions / login-credentials fields.

Keep both in sync if the demo account or flows change.

---

## Demo account (full access)

> **Email:** `demo-admin@rouxte-pro.test`
> **Password:** `rouxte-demo`

This is an **org admin** account on a fully-seeded showcase organization (a 43-person
dealer org with ~2,000 leads, quotes, training, payroll, and 90 days of activity). It
has an **active subscription**, so the reviewer sees the entire app with no gate.

Sign in from the app's login screen using **email + password** (or Sign in with Apple /
Google to create your own account — but the demo account above is pre-populated and is
the fastest way to review every feature).

> ⚠️ **Prerequisite for the submitter (not the reviewer):** the demo account must exist
> in the **production** Supabase that the shipped build points at (`API_BASE_URL`), and
> email/password sign-in must be enabled for it. Verify you can log in with the
> credentials above on a release build before submitting.

---

## Apple — App Store Connect reviewer notes

**What Rouxte is**
Rouxte is a B2B field-sales platform sold to door-to-door fiber/wireless **dealer
organizations** for use by their employees (sales reps, team leads, and managers). It is
not a consumer app. People do not sign up individually off the street — they join an
organization that an administrator has already set up, via an invite.

**Why the app contains no in-app purchase (Guideline 3.1.3(c) — Enterprise Services)**
Rouxte subscriptions are sold **directly to organizations for their employees**, which
qualifies for the in-app-purchase exemption under Guideline 3.1.3(c). Consistent with
that:

- The app contains **no purchasing UI whatsoever** — no prices, no "subscribe" or "start
  trial" actions, no checkout, and no links that steer the user to an external purchase.
- An organization's subscription is arranged and managed entirely **off-platform on the
  web** by the org's administrator. The app is purely a **client** for that enterprise
  service.
- Individual reps can never purchase anything; only the organization buys, on behalf of
  its team.

If an organization has no active subscription, the app shows a plain **informational**
message ("your organization's subscription is managed at rouxte.com") with a *Check
again* and *Sign out* button — no purchase path. The demo account above is on an active
subscription, so the reviewer will not hit this screen.

**Other digital/payment surfaces**
- The in-app **Store** sells **physical branded merchandise** (badges, swag) fulfilled by
  a print-on-demand partner. Physical goods are outside the scope of in-app purchase and
  use a standard payment processor, which is permitted.

**Sign in with Apple**
Implemented on the login screen alongside Google and email, per Guideline 4.8.

**Account deletion (Guideline 5.1.1(v))**
In-app account deletion is available at **Settings → Delete account**. It permanently
deletes the user's account and anonymizes their personal information; records the
organization is legally required to retain are anonymized rather than fabricated.

**Permissions**
- **Location (While Using):** the core feature is a door-to-door lead map — reps drop and
  view leads at street addresses and see their position relative to assigned territory.
- **Camera / Photos (if prompted):** profile photo and lead/site photos.
- **Notifications:** lead assignments, manager sign-off, and meeting alerts.

**How to test the core flows (signed in as the demo admin)**
1. **Map / Leads** — open the Leads/Map tab to see seeded leads; tap a pin for detail.
2. **AI Coach (Rex)** — open Coach and ask a question; responses stream from the server.
3. **Quotes** — build a fiber or wireless quote.
4. **Manager tools** — Queue, People, Payroll, Compensation are visible to this admin.
5. **Meetings** — in-app video rooms (Daily.co) via the Meetings tab.

---

## Google Play — reviewer / testing notes

**App category & access**
Rouxte is a B2B enterprise field-sales tool for fiber/wireless dealer organizations. It
requires an organization account; use the demo credentials above (email + password) to
access full functionality. Provide these in the **Play Console → App access** section so
review is not blocked by the login wall.

**Play Billing**
The app sells **no in-app digital products or subscriptions**. Subscriptions are an
enterprise/B2B arrangement sold to organizations and managed off-app on the web, so Google
Play's billing requirement does not apply. The in-app Store sells **physical merchandise**
only, fulfilled by a print-on-demand partner (physical goods are exempt from Play Billing).

**Data safety / account deletion**
In-app account deletion is at **Settings → Delete account** (permanent delete +
anonymization of legally-retained records). A web deletion path is also available.

**Permissions**
- **Location (foreground only):** door-to-door lead map — placing/viewing leads at
  addresses and showing the rep's position relative to territory.
- **Notifications:** lead assignment, manager sign-off, meeting alerts.
- **Camera / storage (if applicable):** profile and site photos.

---

## Maintenance checklist (submitter)

- [ ] Demo admin account is seeded and loginable on the **production** API the build targets.
- [ ] Store listing copy and screenshots contain **no pricing or "subscribe" language**
      (the exemption posture must be consistent across binary + listing).
- [ ] Account-deletion path still resolves to **Settings → Delete account**.
- [ ] Sign in with Apple still present (iOS).
