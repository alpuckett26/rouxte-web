# Your role in the Anseur stack (Rouxte)

> Canonical contract: `PIPELINE-ROLES.md` in `alpuckett26/restaurant-ai-ordering`
> — shapes and semantics change THERE first. This file is your standing role
> card; if it disagrees with canonical, canonical wins.

**The stack:** Answers/ANSEUR (restaurant-ai-ordering) is the spine — the
restaurant record, telephony, orders, payments. Wrepo (botseat) = menu
ingestion + website engine. GroBigga = growth (lead gen, presence scans,
analytics, brand capture). Vidvid = video content. **Rouxte (this repo) =
the sales layer: leads, routes, salespeople.** Coordination happens via
GitHub issues between repos.

## Your standing duties

- Two-way sync with the spine: `external_ref` = restaurant_id; sync on
  `assigned_to` (salesperson) and `lifecycle_status` (lead → audited →
  pitched → onboarding → live).
- Geocode + route the day's walk-ins for the sales team.
- When GroBigga drops leads onto the pipeline, they appear in your world
  for routing; the walk-in packet for each lead is assembled by Answers
  (all four team inserts merged) — a lead is walk-in-ready only when its
  packet gate is green.
