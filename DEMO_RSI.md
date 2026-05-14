# RS&I Demo Script

**Audience:** RS&I (master dealer)
**Goal:** Get them excited enough to want the Enterprise rev-share conversation
**Estimated length:** 8–10 min talk + Q&A
**Format:** Live web walkthrough. Open `/pricing` first, then sign in to a demo org.

---

## Pre-demo checklist (do this 30 minutes before)

- [ ] `.env.local` has `NEXT_PUBLIC_BILLING_DEMO_MODE=true` **and** `BILLING_DEMO_MODE=true`
- [ ] Server SQL has been run: `org_subscriptions` table exists, `orgs.onboarding_state` column exists
- [ ] Reset your demo org's subscription so the modal appears fresh:
      ```sql
      delete from org_subscriptions where org_id = '<YOUR_ORG_ID>';
      update orgs set onboarding_state = '{}'::jsonb,
                       onboarding_completed_at = null
                where id = '<YOUR_ORG_ID>';
      ```
- [ ] `npm run dev` is running, browser at `http://localhost:3000`
- [ ] Have a second tab open at `/pricing` (public marketing page) ready to switch to
- [ ] Logged out of any test sessions in incognito so the demo runs from a "clean" perspective

---

## The pitch (8 minutes, beat by beat)

### 1 · "Here's what your sub-dealers see when they come to Rouxte" (1 min)

**Open `/pricing`** (public page).

> "When a fiber or wireless dealer hears about us, this is where they land. Per-rep monthly,
> 30-day free trial on every plan. We collect a card up front so they don't get cut off on
> day 31, but we don't charge anything during the trial."

**Scroll to the comparison table.** Linger 3 seconds on Pro.

> "Most of your sub-dealers are going to land on Pro. It's the package that includes the
> manager queue, payroll, quoting, in-app meetings — the stuff a real dealership needs to
> run. Field is the entry point — solo reps, brand new crews. Enterprise is where you and I
> come in."

**Scroll to Enterprise card (the dark one).** Tap the "Master dealer rev-share" bullet with your cursor.

> "Enterprise is the tier we built specifically for master dealers like you. White-label,
> multi-org control, and a revenue-share on every sub-dealer you bring onto the platform.
> We pay you for the life of the account."

### 2 · "Watch a new org sign up" (2 min)

**Sign in to your demo org.** Land on `/dashboard`. **The PricingModal opens automatically.**

> "When a new admin hits the app, they can't actually use Rouxte until they're on a plan.
> This modal blocks the dashboard until they pick something."

**Pick Pro.** Show the card form step.

> "We're in demo mode right now so I can skip the card. In production this is Square Web
> Payments — PCI-compliant, tokenized client-side, we never touch the actual card number.
> The save just creates a Square Customer and saves the card on file. No charge until day 31."

**Click "Start my 30-day free trial."**

### 3 · "Now they have to set up their org" (2 min)

Wizard fires automatically.

> "Right after they're a paying customer-in-waiting, we walk them through everything that
> makes the rest of the app work. Three minutes, mostly skippable."

**Walk through:**
- Org name + niche + carrier picks → "this filters their map overlay and Coach knowledge"
- Branding step → "their logo on quotes, their color on the funnel"
- Team invites → "paste 50 emails, hit continue, every rep gets a one-click signup email through Resend"
- Territory zips → "we pre-fetch FCC fiber coverage for these areas so the map loads instantly when they zoom in"

**Click "Save and take the tour."**

### 4 · "Then we hand-hold them through the product" (2 min)

Lands on `/getting-started?welcome=1`.

> "Twelve sections, every feature in Rouxte explained in plain English with deep links into
> the app. This is the difference between paying for software and actually using it."

**Click the Map section open.** Show the "How to use it" steps.

**Then click "Open Map →".** Land on the actual map page.

> "Every section deep-links to the real surface. New rep, new manager, they can come back
> to this any time and find what they need."

### 5 · "And during the trial we keep them oriented" (30 sec)

**Notice the trial banner at the top.** "Trial · N days left · Manage billing."

> "Sticky banner, every page. Click 'Manage' and you're in the billing screen — change
> card, change plan, cancel."

**Click "Manage billing."** Show the `/billing` screen.

> "This is what your sub-dealer manages on their own. We don't have to be in the loop for
> card updates, cancellations, none of that. It's all self-serve."

### 6 · "Here's why RS&I should care" (1 min)

Pivot to the value prop.

> "Three things matter here for you:
>
> One — **your sub-dealers stop quitting**. The reason dealers churn off door-to-door tools
> is they don't see ROI in the first 30 days. The wizard + getting-started flow + AI Coach
> push that activation curve hard.
>
> Two — **the rev-share scales with your roster**, not with our sales effort. Every dealer
> you bring on pays us monthly, and you collect on every invoice they pay.
>
> Three — **we're not building another generic CRM**. Every feature here is built for the
> door — Field Mode, FCC fiber overlay, fiber and wireless quote builders, the carrier
> overlay, the sales activity logger that goes incident-flag when someone hits a no-solicit.
> Generic SaaS can't do that. We can because we focus."

---

## Likely questions + answers

**Q: How do you handle our existing dealers' data?**
A: Migration is a service we provide on the Enterprise tier. Bring your CSV / Salesforce export / whatever and we import + clean. Roadmap item: a direct connector to the top 3 dealer CRMs.

**Q: Can sub-dealers be on different tiers?**
A: Yes — each dealer is its own org with its own subscription. RS&I sees roll-up reporting across all of them in your Enterprise console.

**Q: White-label — how deep does it go?**
A: Custom domain, custom logo, custom accent color org-wide. Custom email sender (so reps see invites from "Powered by RS&I" not Rouxte). API access for embedding the SmartPitch funnel in your existing dealer portal.

**Q: SOC 2? HIPAA?**
A: We're on SOC 2-Type-II infrastructure (Supabase + Vercel). We don't collect PHI so HIPAA doesn't apply. The dealer-side compliance work (DNC scrub, state solicitation rules, do-not-knock lists) is on the Enterprise roadmap.

**Q: What about the iPhone / Android app?**
A: Native React Native app, same features, available now. Reps live in the mobile app; managers usually prefer web for the back-office stuff. *(If they push: mobile billing manage UI is shipping next sprint — the core flow works on mobile today, billing is web-only for the first cohort.)*

**Q: Pricing flexibility for big rosters?**
A: That's an Enterprise conversation. Volume discounts, annual commits, custom rev-share — we work that with master dealers like you.

**Q: When do you actually charge?**
A: Day 31, automatically. Card on file gets charged for tier price × active reps that month. We don't bill inactive reps; "active" means logged at least one event during the period.

---

## If something breaks (recover gracefully)

**Modal doesn't appear:**
- Hard-refresh the browser
- Check that `org_subscriptions` row is empty for your org
- If still broken: open `/pricing` instead — same content, public-facing

**Square SDK fails:**
- Toggle demo mode in `.env.local` and restart `npm run dev`
- Or just skip the card-entry beat in the demo: "We're not going to wire the card here, that's the Square integration we already have working in our merch store"

**Wizard 500s:**
- The wizard API requires the `onboarding_state` column. Verify the second SQL block ran.
- Worst case, skip the wizard step and go straight to `/getting-started` to demo that.

**Trial banner doesn't show:**
- Means your org has no `org_subscriptions` row or the status isn't 'trialing'. Run the SQL to insert a trialing row pointing 30 days out.

---

## Backup slides (in case wifi dies)

Have these screenshots in a folder on desktop, just in case:
- `/pricing` page
- PricingModal step 2 (card form)
- Wizard step 3 (branding with color picker)
- Getting Started page with TOC open
- Billing manage page with trial banner

If the laptop melts, walk through the screenshots in order — the story still works.
