# RS&I Demo Script

**Audience:** RS&I — master dealer
**Goal:** Get them excited enough to want the Enterprise rev-share conversation
**Length:** 8–10 min walkthrough + Q&A
**Format:** Live web. Open `/pricing` first (shareable URL), then walk through a signup.
**Tone:** Confident, direct, no soft-pedal. Anchor against SPOTIO explicitly.

---

## Pre-demo checklist (do 30 min before)

- [ ] **Vercel env vars set in production:**
  - `NEXT_PUBLIC_BILLING_DEMO_MODE=true`
  - `BILLING_DEMO_MODE=true`
  - (Skip the `NEXT_PUBLIC_SQUARE_*` vars unless you want the real Square SDK form. Demo mode is more reliable for live presentation.)
- [ ] **Supabase has the schema:** `org_subscriptions` table + `orgs.onboarding_state` / `onboarding_completed_at` columns
- [ ] **Supabase custom SMTP configured** (so the signup confirmation email comes from `noreply@rouxte.com`, not Supabase's default)
- [ ] **Reset your demo org so the modal opens fresh:**
  ```sql
  delete from org_subscriptions
    where org_id = (select org_id from user_profiles where user_id = auth.uid());
  update orgs set onboarding_state = '{}'::jsonb,
                  onboarding_completed_at = null
    where id = (select org_id from user_profiles where user_id = auth.uid());
  ```
- [ ] Browser tabs prepped:
  - Tab 1: `https://rouxte.com/pricing`
  - Tab 2: `https://rouxte.com` (landing)
  - Tab 3: `https://rouxte.com/migration` (in case they ask)
  - Tab 4: signed-out in incognito so signup flow is clean
- [ ] Phone charged in case you want to demo mobile mid-pitch

---

## The pitch (8–10 minutes, beat by beat)

### 1 · "This is what your sub-dealers see" (60 sec)

**Open Tab 1: `https://rouxte.com/pricing`.**

> "When a fiber or wireless dealer hears about us, this is where they land."

**Pause on the headline.** Let them read: *"Built for fiber and wireless crews — without SPOTIO-level pricing."*

> "That's the pitch — we're SPOTIO for door-to-door telecom, at a starter-friendly price. $9.99 a rep on Field. $19.99 on Pro. Everything in between is what your sub-dealers stop fighting because we built it for the door, not for an enterprise CRM."

**Hover on the team-pricing math under each card.**

> "A 15-rep crew on Pro is $300 a month. They're spending more than that on Calendly and DocuSign alone right now."

### 2 · "Why our pricing makes sense to dealers" (60 sec)

**Stay on `/pricing`. Scroll to the trust-badges row.**

> "No annual contract required. Cancel anytime during trial. Per-rep monthly billing. No setup or onboarding fees. The opposite of every other platform's sales process."

**Scroll to the Founding Dealer Program section.**

> "Right now we're onboarding our first wave of dealers. Founding-dealer pricing is locked for life. White-glove onboarding included. Direct line to our founders — your feedback shapes the platform. The minute we go public, prices go up and these perks go away."

**That's the close-fast hook. Don't dwell.**

### 3 · "Now watch what happens when a dealer signs up" (2 min)

**Switch to Tab 4 (incognito). Sign up with a throwaway email.**

> "Brand new admin. They just got the email confirmation. The first thing they see after verifying is the welcome page — what's in the box, four-step roadmap to setup, ten minutes total."

**Land on `/onboarding/promo`.** Let them read the 9-card capability grid for a beat.

> "Notice we're not making them watch a 15-minute video tour. The card grid IS the tour. They can scan it in 20 seconds and know what they bought."

**Click "Let's go" → fill profile → land on `/dashboard`.** The PricingModal opens.

> "And here's the gate. They can't actually use Rouxte until they pick a plan. This blocks every authenticated surface."

### 4 · "Picking a plan" (90 sec)

**Pause on the modal.** Three tier cards side by side. Most popular badge on Pro, lime-green "For master dealers" on Enterprise.

> "Three tiers. The buyer-targeting line on each tells them in one sentence whether this is for them. Field is solo reps. Pro — and this is the money tier — is for dealer teams selling fiber and wireless daily. Enterprise is for master dealers like you."

**Click Pro.**

> "Now they pick how they pay. Apple Pay, Google Pay, or card. Square processes everything — PCI-tokenized, we never touch the card number."

**Point at the trust footer.** *Secured by Square · VISA · MC · AMEX · DISC.*

> "And we're in demo mode right now so I'll skip the actual card entry, but in production this is the real Square Web Payments SDK."

**Click "Start my 30-day free trial."**

### 5 · "Then we walk them through setup" (90 sec)

Wizard fires automatically.

> "The minute they're a paying customer-in-waiting, we set up their org. Six steps. Skippable where it makes sense."

**Click through fast:**
- Welcome → "Three minutes, mostly skippable"
- Org → "Niche, carriers — this filters their map overlay and Coach knowledge"
- Branding → "Logo and accent color show up on quotes, funnels, customer emails"
- Team → "Paste 50 emails, hit continue, every rep gets an invite from Resend"
- Territory → "Zip codes we pre-fetch FCC fiber coverage for"
- Done → summary cards

**Click "Save and take the tour."**

### 6 · "And we walk them through every feature" (2 min)

Lands on `/getting-started?welcome=1`. Sixteen sections — Dashboard, Map, Leads, SmartPitch, Digital Card, Coach (Rex), Quotes, Logger, Goals/Leaderboard, Manager Queue, Field Readiness, Payroll, Meetings, Training, Store, Settings.

> "Sixteen sections covering every feature, with deep links into the app. New rep, new manager, they pin this page in their browser and come back as questions come up."

**Open the Map section** — read the bullets, point at the FCC fiber overlay note.

> "Real FCC AT&T fiber coverage at every address. Knock smart, not blind."

**Open AI Coach (Rex) section.**

> "Claude-powered. Trained on your scripts. Voice mode. Homeowner roleplay. Reps get 50 prompts a day on Field, unlimited on Pro. Managers and admins always unlimited."

**Click "Open Map →"** to show the deep-link works → actual map page loads.

> "Every section deep-links to the real screen."

### 7 · "And the trial banner keeps them oriented" (30 sec)

**Notice the sticky banner at the top of every page.** *Trial · 30 days left · Manage billing.*

> "Sticky, every page. One click to manage their card or cancel — fully self-serve. We don't need to be in the loop."

**Click "Manage billing"** → `/billing` screen.

> "Plan, status, days left, card on file, update card, cancel. They run their own billing."

### 8 · "Here's why RS&I should care" (90 sec)

Pivot to the value prop.

> "Three things matter for you specifically.
>
> **One — your sub-dealers will stop quitting.** The reason dealers churn off door-to-door tools is they don't see ROI in the first 30 days. The wizard, the directions-for-use page, and Rex coaching reps at 9pm push that activation curve hard.
>
> **Two — Enterprise pays YOU.** Master dealers on Rouxte Enterprise get rev-share on every sub-dealer's monthly invoice — for the life of the account. Sales-led, not service-led. Your roster grows, your cut grows.
>
> **Three — we're not building another generic CRM.** Every feature is built for the door. FCC fiber overlay on the map. Carrier-aware quoting. Compliance logger. Field Mode with offline knock queue. SPOTIO can't ship these because they're not vertical-built. We can because we are."

### 9 · "Want to migrate your existing sub-dealers?" (60 sec)

**Switch to Tab 3: `https://rouxte.com/migration`.**

> "White-glove concierge migration. Five days, zero downtime. Discovery call, data mapping, staging review you sign off on, cutover. Included on Enterprise. Founding dealers get it free. Everyone else pays a flat $499 under 10 reps or a per-rep rate above."

**Scroll through the 8 source platforms.** SPOTIO, SalesRabbit, Salesforce, Pipedrive, Sheets, etc.

> "We handle the export wrangling. Your reps keep knocking the whole time."

### 10 · Close — book the follow-up

> "What I'd want next is a 30-minute call with whoever runs sub-dealer onboarding at RS&I. We talk through your roster, your current toolchain, and what a founding-dealer Enterprise relationship looks like specifically for you. When works?"

**Have a date in mind. Get a calendar invite on the spot.**

---

## Likely questions + prepared answers

**Q: How do you handle our existing dealers' data?**
A: White-glove concierge service detailed at `/migration`. Five days, zero downtime. Founding dealers and Enterprise customers get it included.

**Q: Can sub-dealers be on different tiers?**
A: Yes — each dealer is its own org with its own subscription. As a master dealer you'd see roll-up reporting across all of them in your Enterprise console.

**Q: White-label — how deep does it go?**
A: Custom domain, custom logo, custom accent color org-wide. Custom email sender (so invites from your sub-dealers say "Powered by RS&I" not Rouxte). API access for embedding the SmartPitch funnel in your existing portal.

**Q: SOC 2? HIPAA?**
A: We're on SOC 2-Type-II infrastructure (Supabase + Vercel). We don't collect PHI so HIPAA doesn't apply. State solicitation rules and DNC scrubs are Enterprise-tier compliance features.

**Q: What about the iPhone / Android app?**
A: Native React Native app on both stores. Reps live in the mobile app — Field Mode, offline knock queue, GPS puck, speech-to-text everywhere, push notifications. Managers usually prefer web for the back-office stuff.

**Q: Pricing flexibility for big rosters?**
A: That's the Enterprise conversation. Volume discounts, annual commits, custom rev-share — those all live there. We work the numbers with master dealers like you.

**Q: When do you actually charge?**
A: Day 31, automatically. Card on file gets charged for tier price × active reps that month. We don't bill inactive reps — "active" means logged at least one event during the period.

**Q: How is Rex different from ChatGPT?**
A: Rex is trained on YOUR scripts, YOUR competitive intel, and YOUR rebuttal library. It's not a generic LLM — it knows AT&T's pitch language versus Frontier's, knows your sub-dealer's product matrix, knows when a rep is asking about a real homeowner objection versus practicing. Voice mode lets reps roleplay hands-free.

**Q: Why should I trust you over SPOTIO?**
A: SPOTIO is generic field sales. We're door-to-door telecom-native. They charge $75/rep/mo for less. We're starter-friendly at $9.99 because we're earning your trust. Founding-dealer pricing locks in for life — even when we go public and rates go up.

---

## If something breaks (graceful recovery)

**The pricing modal doesn't appear after signin:**
- Hard-refresh
- Check `org_subscriptions` is empty for your org (Supabase SQL editor)
- Fall back to walking through `/pricing` directly — same content, public-facing

**Demo mode submission errors:**
- Check both `NEXT_PUBLIC_BILLING_DEMO_MODE=true` AND `BILLING_DEMO_MODE=true` are set in Vercel env
- Redeploy if you just set them

**Wizard 500s:**
- Verify `orgs.onboarding_state` column exists (`alter table orgs add column if not exists onboarding_state jsonb default '{}'`)
- Worst case: skip the wizard step entirely, walk through `/getting-started` directly

**Trial banner doesn't show:**
- Means the `org_subscriptions` row insert failed or `status !== 'trialing'`. SQL-check the row.

**Anything else:** keep moving. The story works even if a click breaks. Don't apologize on stage — say "great catch, we'll fix that today" and move to the next beat.

---

## Backup if the wifi dies

Have these screenshots in a desktop folder, ready to walk through in order:

1. `/pricing` hero with SPOTIO headline + 3 tier cards
2. PricingModal step 1 (tier picker)
3. PricingModal step 2 (Apple Pay + Google Pay + card)
4. Wizard step 3 (Branding with color picker showing brand colors)
5. `/getting-started` with the TOC and Map section expanded
6. `/billing` manage page with trial banner visible
7. `/migration` page with the 5-day process
8. Mobile app Field Mode on a phone screenshot

If laptop dies, walk through the screenshots in order. The story still works.

---

## URLs to share / reference

| Surface | URL |
|---|---|
| Landing (organization in a box) | https://rouxte.com |
| Public pricing | https://rouxte.com/pricing |
| Migration concierge | https://rouxte.com/migration |
| Getting started TOC | https://rouxte.com/getting-started |
| Sales contact | sales@rouxte.com |
| Migration contact | migrations@rouxte.com |

---

## Post-demo follow-up

Send within 4 hours of the meeting:
- Recap email with the demo URLs
- Founding-dealer pricing sheet (PDF, separately)
- Calendar invite for the 30-min Enterprise call
- Link to `/migration` if they asked about switching
