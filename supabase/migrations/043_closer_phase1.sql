-- Migration 043: Setter → Closer → Sale (rouxte-web#19, Phase 1)
--
-- Numbering: 041 and 042 belong to the outreach-sequencing branch (PR #20).
-- Nothing here depends on them; the gap is deliberate so two open branches do
-- not both claim 041.
--
-- Scope discipline. The audit on #19 found ~70% of the Closer brief already has
-- a home in this schema. This migration adds ONLY the three things that do not:
-- the appointment object, its attribution, and the deployment record that says
-- what job a person is doing. Everything else (users, teams, leads, notes,
-- status history, sales_activity_log, meetings, competitor_intel, pay_periods)
-- is reused as-is.

-- ─── sales_function ───────────────────────────────────────────────────────────
-- Deliberately NOT added to user_role.
--
-- user_role means AUTHORITY and is referenced by RLS policies on effectively
-- every table in this database; adding 'setter'/'closer' to it would be an
-- authorisation rewrite disguised as a schema tweak. sales_function means JOB.
-- Keeping them apart is what lets one person set in the morning and close in
-- the afternoon without touching a single policy.
do $$ begin
  create type sales_function as enum ('setter', 'closer', 'field_rep', 'team_lead');
exception when duplicate_object then null; end $$;

-- ─── rep_deployments ──────────────────────────────────────────────────────────
-- user × program × team × sales_function × territory.
create table if not exists rep_deployments (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references orgs(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  team_id        uuid references teams(id) on delete set null,
  sales_function sales_function not null,
  territory      text,
  -- Free text until the programs table lands in a later phase. Typed as text
  -- rather than invented as an FK to a table nobody has designed yet.
  program        text,
  is_active      boolean not null default true,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- One ACTIVE deployment per person per function. A second closer deployment for
-- the same person is a data error, not a promotion.
create unique index if not exists rep_deployments_active_uniq
  on rep_deployments(user_id, sales_function) where is_active;
create index if not exists rep_deployments_org_fn_idx
  on rep_deployments(org_id, sales_function) where is_active;

-- ─── sales_appointments ───────────────────────────────────────────────────────
-- The genuinely missing object. `meetings` is a Daily video room — it has no
-- lead, no setter, no closer and no outcome — so the room is LINKED here, never
-- duplicated.
create table if not exists sales_appointments (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references orgs(id) on delete cascade,
  lead_id       uuid not null references leads(id) on delete cascade,
  setter_id     uuid not null references auth.users(id),
  -- Nullable on purpose: an appointment can be booked into the closer pool and
  -- claimed later. The queue exposes that pool rather than hiding it.
  closer_id     uuid references auth.users(id) on delete set null,
  meeting_id    uuid references meetings(id) on delete set null,

  scheduled_at     timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 480),

  -- THE HANDOFF. This is the entire point of the object: a booking without it
  -- is a calendar entry, and a closer walking in with a calendar entry is the
  -- failure mode the Closer brief exists to fix. NOT NULL is the enforcement.
  qualification_notes text not null check (length(btrim(qualification_notes)) > 0),
  decision_maker         text,
  decision_maker_present boolean,
  pain_points            text[] not null default '{}',
  known_objections       text[] not null default '{}',
  -- 1–5. Null means the setter did not rate it — which is different from a 1.
  estimated_fit smallint check (estimated_fit between 1 and 5),

  -- Null while the appointment is still pending. Text + CHECK rather than an
  -- enum: outcomes are the vocabulary most likely to grow, and ALTER TYPE is a
  -- worse migration than a dropped-and-recreated constraint.
  outcome text check (outcome in ('closed', 'lost', 'no_show', 'rescheduled', 'cancelled')),
  outcome_notes text,
  outcome_at    timestamptz,
  outcome_by    uuid references auth.users(id),
  -- When outcome = 'rescheduled', the appointment that replaced this one.
  rescheduled_to uuid references sales_appointments(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An outcome without a timestamp is unauditable, and a timestamp without an
  -- outcome is a half-written row. Neither is allowed to exist.
  constraint sales_appointments_outcome_complete
    check ((outcome is null) = (outcome_at is null))
);

create index if not exists sales_appointments_closer_queue_idx
  on sales_appointments(org_id, closer_id, scheduled_at) where outcome is null;
create index if not exists sales_appointments_pool_idx
  on sales_appointments(org_id, scheduled_at) where outcome is null and closer_id is null;
create index if not exists sales_appointments_lead_idx
  on sales_appointments(lead_id, scheduled_at desc);
create index if not exists sales_appointments_setter_idx
  on sales_appointments(setter_id, scheduled_at desc);

-- ─── sale_attributions ────────────────────────────────────────────────────────
-- A deal has contributors. Reps are paid on residuals, so this table is the
-- input to money and is treated accordingly.
create table if not exists sale_attributions (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references orgs(id) on delete cascade,
  lead_id        uuid not null references leads(id) on delete cascade,
  -- CASCADE, not SET NULL: an attribution orphaned from its appointment cannot
  -- be grouped, and an ungroupable share cannot be checked against the sum
  -- rule below. A row that silently escapes the rule is worse than no row.
  appointment_id uuid references sales_appointments(id) on delete cascade,
  -- The sale_submitted row in the append-only log, when there is one.
  log_id         uuid references sales_activity_log(id) on delete set null,
  user_id        uuid not null references auth.users(id),
  sales_function sales_function not null,
  share          numeric(5,4) not null check (share > 0 and share <= 1),
  -- 'explicit' when the caller supplied the split, 'default_equal_split' when
  -- the system divided it evenly. Recorded because a payout computed from an
  -- invented number must at least admit that it was invented.
  share_source   text not null default 'explicit'
                 check (share_source in ('explicit', 'default_equal_split')),
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),

  unique (lead_id, appointment_id, user_id, sales_function)
);

create index if not exists sale_attributions_user_idx
  on sale_attributions(user_id, created_at desc);
create index if not exists sale_attributions_lead_idx
  on sale_attributions(lead_id);

-- Shares for one sale must sum to exactly 1.
--
-- This is a DEFERRABLE constraint trigger, so a whole attribution set inserted
-- in one statement is checked once at commit rather than row by row. It exists
-- because the alternative — a set that sums to 0.5 because half of it failed to
-- write — pays a rep half of what they earned and looks like a correct row
-- while doing it. Correcting an attribution means replacing the whole set.
create or replace function sale_attributions_sum_check() returns trigger
language plpgsql as $$
declare
  v_lead uuid;
  v_appt uuid;
  v_count int;
  v_sum numeric;
begin
  v_lead := coalesce(new.lead_id, old.lead_id);
  v_appt := coalesce(new.appointment_id, old.appointment_id);

  select count(*), coalesce(sum(share), 0) into v_count, v_sum
  from sale_attributions
  where lead_id = v_lead
    and appointment_id is not distinct from v_appt;

  -- An empty group is a deleted set, not a broken one.
  if v_count = 0 then return null; end if;

  if v_sum <> 1 then
    raise exception
      'sale_attributions shares for lead % must sum to 1, got % across % row(s)',
      v_lead, v_sum, v_count;
  end if;
  return null;
end $$;

drop trigger if exists sale_attributions_sum_trg on sale_attributions;
create constraint trigger sale_attributions_sum_trg
  after insert or update or delete on sale_attributions
  deferrable initially deferred
  for each row execute function sale_attributions_sum_check();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table rep_deployments    enable row level security;
alter table sales_appointments enable row level security;
alter table sale_attributions  enable row level security;

-- Deployments: everyone in the org can see who is deployed as what (the setter
-- has to be able to pick a closer). Only managers write.
create policy "rep_deployments: read" on rep_deployments for select
  using (org_id = my_org_id());
create policy "rep_deployments: write" on rep_deployments for all
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'))
  with check (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'));

-- Appointments: org-visible (a closer queue nobody can see is not a queue).
create policy "sales_appointments: read" on sales_appointments for select
  using (org_id = my_org_id());
create policy "sales_appointments: insert" on sales_appointments for insert
  with check (org_id = my_org_id() and setter_id = auth.uid());
-- The two people on the appointment can update it; so can a manager. An
-- unclaimed appointment (closer_id is null) is claimable by anyone in the org.
create policy "sales_appointments: update" on sales_appointments for update
  using (
    org_id = my_org_id() and (
      setter_id = auth.uid()
      or closer_id = auth.uid()
      or closer_id is null
      or my_role() in ('admin', 'sales_manager', 'team_lead')
    )
  );
create policy "sales_appointments: delete" on sales_appointments for delete
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'));

-- Attributions: readable org-wide (reps must be able to audit their own pay),
-- writable only by managers directly. The outcome route writes them through the
-- service-role client after it has checked the caller.
create policy "sale_attributions: read" on sale_attributions for select
  using (org_id = my_org_id());
create policy "sale_attributions: write" on sale_attributions for all
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'))
  with check (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'));

-- ─── updated_at ───────────────────────────────────────────────────────────────
create or replace function sales_appointments_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sales_appointments_touch_trg on sales_appointments;
create trigger sales_appointments_touch_trg
  before update on sales_appointments
  for each row execute function sales_appointments_touch();
