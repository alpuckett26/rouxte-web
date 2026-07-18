# Rouxte's role in the Anseur stack

> Canonical contract: `PIPELINE-ROLES.md` in `alpuckett26/restaurant-ai-ordering`
> — shapes and semantics change THERE first. This file is Rouxte's standing
> role card; if it disagrees with canonical, canonical wins.

**The stack:** Answers (public brand **ANSEUR**, repo `restaurant-ai-ordering`)
is the spine — restaurant record, AI phone line, orders, payments. Wrepo
(`botseat`) = menu ingestion + restaurant websites. GroBigga = growth: lead
sourcing, presence scans, SEO, conversion tracking. Vidvid = video content.
**Rouxte (this repo) = the sales layer:** map + lead tracking, reps, routes,
residual comp. The internal/technical name stays "answers" everywhere
(env vars, API paths, `lib/answers/`); only rep-facing copy says Anseur.

## Platform laws (binding on every session in this repo)

- **Dark zone:** never write to another repo — no commits, no file plants,
  no clones. Reading/searching other repos is fine. Cross-repo asks ride
  the bus (GitHub issues on the target repo, titled `<From> → <To>: <ask>`).
- **The bus is pull-based — check your inbox.** At session start and between
  work blocks: `gh issue list --repo alpuckett26/rouxte-web --state open`
  and re-read comment threads you're party to.
- **Proof or it didn't happen.** A "done" comment must carry verifiable
  evidence (live URLs, test output, screenshots).
- **Secrets never ride the bus** — handoff via
  `C:\Users\alpuc\Documents\platform\.handoff\<KEY_NAME>`, note "placed" on
  the issue.
- Full law book: `../CLAUDE.md` (the platform workspace CLAUDE.md).

## The sync (shipped — PR #4, merged 2026-07-16)

Two-way lead sync with the spine. Implementation detail lives in this
repo's `CLAUDE.md` § "Anseur (Answers) pipeline sync"; code in
`lib/answers/client.ts`, `app/api/cron/answers-sync/route.ts`,
`supabase/migrations/038_answers_external_ref.sql`.

- **Join key:** `leads.external_ref` = Answers `restaurant_id`, with
  `external_source = 'answers'`.
- **Pull:** cron every 15 min hits `GET /admin/restaurants/pipeline` and
  upserts leads (name/address/phone/lifecycle_status), geocoding anything
  without coords. Pre-existing leads are adopted by address match and
  stamped with their `external_ref`.
- **Push-in (lead-drop rail, rouxte-web#7 / PR #8):** the spine pushes each
  newly sourced lead to `POST /api/answers/load` the moment it exists
  (`X-Answers-Secret` = `ANSWERS_BUILD_SECRET`); the pull cron reconciles
  any push the rail misses. One-shot backfill:
  `POST /api/answers/backfill?since=<iso>` (Bearer `CRON_SECRET`). All
  three paths share the upsert rules in `lib/answers/upsertLead.ts`.
- **Status authority:** Answers wins only while a lead is still `new`;
  once a rep works it, Rouxte is authoritative until sold.
- **Push-back:** rep status changes at `PATCH /api/leads/[id]` map
  `sold → onboarding`, `interested/appointment → pitched`, carrying the
  assigned rep's name for the spine's `assigned_to`. Best-effort; the cron
  reconciles drift.
- **Auth to Answers:** `X-Internal-Secret` (`ANSWERS_INTERNAL_SECRET`,
  preferred) with `ANSWERS_ADMIN_TOKEN` JWT fallback.

## Standing duties

- Keep the two-way sync healthy: reps see spine leads on the map within
  15 min of GroBigga dropping them; spine sees rep outcomes.
- Geocode + route the day's walk-ins for the sales team.
- **Walk-in packet gate:** each lead's packet is assembled by Answers from
  the four product inserts (Wrepo, Vidvid, GroBigga, Answers — per the
  canonical "Who owes what" table, Rouxte does not owe an insert). A lead
  is walk-in-ready only when its packet gate is green; don't route reps to
  a lead whose packet isn't locked/printed.
- **Report bugs in the war room (standing rule, Aaron 2026-07-19):**
  any bug, breakage, or gap you find — in your lane or another
  member's — goes to the war room immediately with concrete evidence
  (endpoint, status code, error text). Finder posts, owner fixes,
  captain verifies. Never sit on it; never route it only to Aaron to
  relay. Canonical wording: answers repo `WAR-ROOM.md` #8 +
  `PIPELINE-ROLES.md`.
- If Rouxte ever ships a per-restaurant artifact, publish it to the spine
  via `POST /internal/provision/restaurants/:id/satellites`
  (X-Internal-Secret) per the canonical contract.

## Trigger

Packet/pipeline flow is **event-driven**: GroBigga sourcing a lead onto
the spine is the trigger. The lead reaches Rouxte automatically — pushed
instantly via the lead-drop rail, with the 15-min pull sync as the
reconciliation net — no manual entry. The issues bus is runtime-READ-ONLY:
no service writes issues; coordination stays session-to-session.
