# Store screenshots — capture & generate

The store listings need phone screenshots at exact pixel sizes. We capture raw
screenshots from the real app, then composite them into branded, captioned,
correctly-sized assets with `scripts/generate-store-screenshots.ts`.

## 1. Set up a demo org (do this first)

**Never use real customer data in screenshots** — it's a privacy violation and
looks unprofessional. Sign in to a demo/test org seeded with fake leads
(fake names, addresses, phones). The web seed scripts under `scripts/seed-*.ts`
can create one.

## 2. Capture raw screenshots on your phone

You already have the app installed via Play internal testing. For each screen
below, open it in the app and take a screenshot (Android: Power + Volume-Down).

| Order | Slug | Screen to capture | Why it sells |
|-------|------|-------------------|--------------|
| 01 | `map` | Map view with colored lead pins | The hero — territory at a glance |
| 02 | `lead` | A lead's detail (status, carrier availability) | "Know before you knock" |
| 03 | `quote` | A finished fiber quote | Quote on the doorstep |
| 04 | `dashboard` | Your dashboard / stats | Numbers climbing |
| 05 | `leaderboard` | Team leaderboard | Competition / motivation |
| 06 | `training` | Training list or AI Coach chat | Coaching in your pocket |

Pick the 4–6 strongest. Play requires **2–8**, Apple requires **at least 3**
(at the 6.7" size; App Store Connect can scale these to other sizes for you).

## 3. Drop them in and name them

Pull the screenshots to your computer and put them here:

```
mobile/store-assets/raw-screens/01-map.png
mobile/store-assets/raw-screens/02-lead.png
mobile/store-assets/raw-screens/03-quote.png
...
```

The `NN-` prefix sets carousel order. The slug after it must match a caption
key in `CAPTIONS` inside the generator script (edit captions there freely).

## 4. Generate

```bash
npx tsx scripts/generate-store-screenshots.ts
```

Output:

```
mobile/store-assets/screenshots/play/NN-slug-1080x1920.png    → Google Play
mobile/store-assets/screenshots/ios67/NN-slug-1290x2796.png   → App Store (6.7")
```

Each output is the brand-blue gradient canvas with a white caption headline on
top and your screenshot framed (rounded corners, centered) below.

## 5. Upload

- **Play Console** → Store listing → Phone screenshots → upload the `play/` set.
- **App Store Connect** → your app → screenshots → 6.7" Display → upload the
  `ios67/` set. App Store Connect will offer to use these for other device
  sizes too.

## Notes

- `raw-screens/` and `screenshots/` are git-ignored (see `.gitignore`) — they
  hold device captures and generated binaries we don't want to version. The
  generator script + this guide are committed; the images are not.
- Re-run the generator any time you recapture; it overwrites cleanly.
