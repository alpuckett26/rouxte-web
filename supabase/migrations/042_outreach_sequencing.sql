-- 042: outreach sequencing and state (rouxte-web#18, item 1).
--
-- Aaron's point, and the reason this is a table and not a rep's memory: one
-- touch does not convert. The thing that has to happen without anyone
-- remembering it is the SECOND and THIRD touch. So the two facts worth storing
-- are (a) where each lead is in its sequence and when the next touch is due,
-- and (b) every touch that was actually attempted, including the ones that were
-- suppressed and why.
--
-- Two tables on purpose:
--   lead_outreach         — mutable cursor. One row per (lead, sequence).
--   lead_outreach_touches — APPEND-ONLY ledger. What happened, forever.
--
-- The ledger is append-only for the same reason sales_activity_log is: it is
-- the record we would produce to answer "why did you email me", and a record
-- that can be edited after the fact answers nothing. Corrections are new rows.
--
-- The SEQUENCE DEFINITIONS are deliberately NOT in here. They live in
-- lib/outreach/sequences.ts, in code, because the GloriaFood cadence is
-- computed against an external shutdown date (2027-04-30) and a step table
-- would freeze a schedule that is supposed to compress as that date nears.

-- ─── The cursor ──────────────────────────────────────────────────────────────
create table if not exists lead_outreach (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  sequence_key text not null,
  -- 0 = enrolled, nothing sent yet. Incremented only by a landed send.
  current_step int not null default 0,
  next_due_at timestamptz,
  state text not null default 'active'
    check (state in ('active', 'paused', 'completed', 'stopped')),
  -- Why it is not active any more. Free text from a closed set in code
  -- (suppressed / replied / anchor_passed / sequence_exhausted / manual).
  stopped_reason text,
  -- Set when a human or an inbound reply took over. A sequence that a rep is
  -- now working must never keep autosending underneath them.
  last_touch_at timestamptz,
  enrolled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, sequence_key)
);

-- The dispatcher's only query: due work in this org, oldest first.
create index if not exists lead_outreach_due_idx
  on lead_outreach (org_id, next_due_at)
  where state = 'active';

create index if not exists lead_outreach_lead_idx on lead_outreach (lead_id);

-- ─── The ledger ──────────────────────────────────────────────────────────────
create table if not exists lead_outreach_touches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  outreach_id uuid references lead_outreach(id) on delete set null,
  sequence_key text,
  step_no int,
  channel text not null check (channel in ('email', 'phone', 'sms', 'door', 'mail')),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  -- 'suppressed' is a first-class outcome, not an error: the gate declining to
  -- send is it working, and it is logged so a silent non-send can never be read
  -- as a send that happened.
  outcome text not null
    check (outcome in ('sent', 'suppressed', 'failed', 'replied', 'bounced', 'complained', 'opted_out')),
  suppression_reason text,
  to_address text,
  subject text,
  body_preview text,
  provider_message_id text,
  -- Provenance snapshot, copied at send time. The lead row can change later;
  -- the answer to "why did you email me, on 2026-08-20" cannot.
  contact_source text,
  contact_sourced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists lot_lead_idx on lead_outreach_touches (lead_id, occurred_at desc);
create index if not exists lot_org_idx on lead_outreach_touches (org_id, occurred_at desc);
create index if not exists lot_outcome_idx on lead_outreach_touches (org_id, outcome, occurred_at desc);

-- Idempotency: at most one LANDED send per (lead, sequence, step). A retried
-- or double-fired cron cannot send the same step twice. Suppressions and
-- failures are excluded so a suppressed step can still be retried once the
-- suppression is lifted.
create unique index if not exists lot_one_send_per_step
  on lead_outreach_touches (lead_id, sequence_key, step_no)
  where outcome = 'sent' and direction = 'outbound' and sequence_key is not null;

create or replace function prevent_outreach_touch_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'lead_outreach_touches is append-only — UPDATE and DELETE are not permitted; insert a correcting row';
end;
$$;

drop trigger if exists lot_no_update on lead_outreach_touches;
create trigger lot_no_update
  before update on lead_outreach_touches
  for each row execute function prevent_outreach_touch_mutation();

drop trigger if exists lot_no_delete on lead_outreach_touches;
create trigger lot_no_delete
  before delete on lead_outreach_touches
  for each row execute function prevent_outreach_touch_mutation();

-- ─── Unsubscribe tokens ──────────────────────────────────────────────────────
-- One opaque token per lead. It goes in the footer of every outbound email so
-- a recipient can remove themselves in one click, without an account and
-- without typing their own address into a form (which is what the door-knock
-- /optout flow asks for, and which nobody does).
create table if not exists outreach_unsubscribes (
  token text primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  email text,
  used_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  unique (lead_id)
);

create index if not exists outreach_unsub_lead_idx on outreach_unsubscribes (lead_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table lead_outreach enable row level security;
alter table lead_outreach_touches enable row level security;
alter table outreach_unsubscribes enable row level security;

drop policy if exists "outreach: read org" on lead_outreach;
create policy "outreach: read org" on lead_outreach
  for select using (org_id = my_org_id());

drop policy if exists "outreach: write org" on lead_outreach;
create policy "outreach: write org" on lead_outreach
  for all using (org_id = my_org_id()) with check (org_id = my_org_id());

drop policy if exists "outreach touches: read org" on lead_outreach_touches;
create policy "outreach touches: read org" on lead_outreach_touches
  for select using (org_id = my_org_id());

drop policy if exists "outreach touches: insert org" on lead_outreach_touches;
create policy "outreach touches: insert org" on lead_outreach_touches
  for insert with check (org_id = my_org_id());

-- No client policy on outreach_unsubscribes beyond org read: the token is
-- redeemed by an unauthenticated stranger, so that path runs service-role in
-- the route handler and RLS stays closed here.
drop policy if exists "outreach unsub: read org" on outreach_unsubscribes;
create policy "outreach unsub: read org" on outreach_unsubscribes
  for select using (org_id = my_org_id());

comment on table lead_outreach_touches is
  'Append-only ledger of every outreach touch, including suppressed ones. This is the record that answers "why did you email me" — corrections are new rows, never edits.';
comment on index lot_one_send_per_step is
  'Idempotency for the dispatcher: a re-fired cron cannot send the same sequence step twice. Suppressed/failed touches are excluded so a lifted suppression can still be retried.';
