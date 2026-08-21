-- 041: the contact and the signals, landed on the lead (rouxte-web#18).
--
-- MEASURED 2026-08-16 against GET /internal/provision/leads?since=2026-01-01:
-- 31 records, 2 carrying a `contact` object, 0 carrying any `signals`. The
-- spine fixed its half (there was no contact field on the record at all, so
-- anything sourcing found was stripped on arrival) — this is Rouxte's half of
-- the same hole: normalizeAnswersLeadPayload read neither key, so even the two
-- contacts that DO arrive were being dropped on the floor here.
--
-- Deliberately flat columns rather than one `contact jsonb`. The send gate
-- reads contact_email / contact_source / do_not_contact on every single send,
-- and those three decide whether a stranger gets an email — they are worth an
-- index, a not-null default and a column comment each, not a JSON path.
-- `signals` stays JSONB because it is genuinely open-ended (the spine adds
-- signal keys without asking us).

alter table leads
  add column if not exists contact_name text,
  add column if not exists contact_role text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_source text,
  add column if not exists contact_sourced_at timestamptz,
  add column if not exists contact_verified boolean,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists do_not_contact_source text,
  add column if not exists signals jsonb not null default '{}'::jsonb;

-- Partial index: the interesting rows are the suppressed ones, and they are
-- the minority. Every dispatch run counts them.
create index if not exists leads_org_do_not_contact_idx
  on leads (org_id)
  where do_not_contact = true;

-- Sendable-cohort lookup: "this org's leads that have an email at all".
create index if not exists leads_org_contact_email_idx
  on leads (org_id)
  where contact_email is not null;

-- Signal membership (`signals ? 'gloriafood'`) is how a cohort is checked
-- locally. It is never how a cohort is DERIVED — that comes from the spine's
-- segment query, so four rails cannot quietly disagree about who is in it.
create index if not exists leads_signals_gin
  on leads using gin (signals);

comment on column leads.contact_source is
  'Provenance: WHERE this contact came from. Null means we cannot answer "why did you email me", and the send gate treats that as not-sendable rather than sending anyway.';
comment on column leads.contact_sourced_at is
  'Provenance: WHEN the contact was sourced. Half of an answer to "why did you email me"; null is treated the same as a null source.';
comment on column leads.do_not_contact is
  'Effective suppression flag, honoured at SEND time, not just at import. Set by the spine (contact.do_not_contact), by an unsubscribe click, by a bounce or by a human. Once true, a sync never clears it — see do_not_contact_source.';
comment on column leads.do_not_contact_source is
  'Who suppressed: ''spine'' | ''unsubscribe'' | ''manual'' | ''bounce'' | ''complaint''. Kept because a spine sync may only ever clear a flag the spine itself set.';
comment on column leads.signals is
  'Open-ended sourcing signals mirrored from the spine (e.g. {"gloriafood": {...}}). Mirror only — the authoritative cohort is GET /internal/provision/segment.';
