-- ─── Safe bootstrap — run this once in the SQL Editor ────────────────────────
-- Wraps all enum/type creation in exception handlers so it's idempotent.

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- Enums (safe create)
do $$ begin create type user_role as enum ('admin', 'sales_manager', 'team_lead', 'sales_rep'); exception when duplicate_object then null; end $$;
do $$ begin create type lead_status as enum ('new', 'attempted', 'contacted', 'qualified', 'appointment_set', 'sold', 'installed', 'closed_lost'); exception when duplicate_object then null; end $$;
do $$ begin create type onboarding_step as enum ('verify', 'promo', 'profile', 'documents', 'complete'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('card', 'cashapp', 'paypal', 'invoice', 'company_plan'); exception when duplicate_object then null; end $$;
do $$ begin create type log_event_type as enum ('lead_assigned', 'lead_unassigned', 'status_changed', 'note_added', 'appointment_set', 'appointment_missed', 'appointment_completed', 'sale_submitted', 'sale_verified', 'sale_rejected', 'no_solicit_observed', 'do_not_knock_marked', 'complaint_received', 'law_enforcement_contact', 'trespass_warning', 'manager_acknowledged', 'manager_approved', 'manager_denied', 'coach_note_added', 'incident_reviewed'); exception when duplicate_object then null; end $$;
do $$ begin create type signoff_action as enum ('acknowledged', 'approved', 'denied'); exception when duplicate_object then null; end $$;

-- Add 'documents' to onboarding_step if missing
do $$ begin alter type onboarding_step add value if not exists 'documents'; exception when others then null; end $$;

-- ─── Core tables ──────────────────────────────────────────────────────────────
create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  tier int not null default 1,
  benefits jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  role user_role not null default 'sales_rep',
  full_name text not null default '',
  territory text,
  carrier_focus text,
  notification_prefs jsonb not null default '{}',
  onboarding_step onboarding_step not null default 'verify',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, org_id)
);

-- Add payroll columns to user_profiles if missing
alter table user_profiles add column if not exists sales_tier_id uuid;
alter table user_profiles add column if not exists standing text not null default 'active' check (standing in ('active','warning','remedial_training','probation'));
alter table user_profiles add column if not exists hourly_rate numeric(10,2);
alter table user_profiles add column if not exists total_sales_count integer not null default 0;
alter table user_profiles add column if not exists trial_started_at timestamptz default now();
alter table user_profiles add column if not exists graduated_at timestamptz;

create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'sales_rep',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  carrier_availability jsonb not null default '{}',
  status lead_status not null default 'new',
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  follow_up_at timestamptz,
  appointment_at timestamptz,
  is_do_not_knock boolean not null default false,
  is_opt_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_org_idx on leads(org_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_assigned_idx on leads(assigned_to);

create table if not exists lead_status_history (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_status lead_status,
  to_status lead_status not null,
  changed_by uuid not null references auth.users(id),
  ts timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  color text not null default 'gray',
  unique(org_id, name)
);

create table if not exists lead_tags (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  ts timestamptz not null default now(),
  unique(lead_id, tag_id)
);

create table if not exists lead_notes (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  ts timestamptz not null default now()
);

create table if not exists opt_out_addresses (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  normalized_address text not null,
  lead_id uuid references leads(id) on delete set null,
  source text not null check (source in ('qr', 'manual')),
  ts timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(org_id, normalized_address)
);

create table if not exists qr_codes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text not null unique,
  campaign text,
  created_at timestamptz not null default now()
);

create table if not exists ai_usage (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  prompts_used int not null default 0,
  total_prompts_used int not null default 0,
  unique(user_id, date)
);

create table if not exists ai_prompt_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  prompt_type text not null,
  tokens int not null default 0,
  ts timestamptz not null default now()
);

create table if not exists sales_activity_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  actor_id uuid not null references auth.users(id),
  team_id uuid references teams(id) on delete set null,
  event_type log_event_type not null,
  summary text not null,
  metadata jsonb not null default '{}',
  amends_log_id uuid references sales_activity_log(id) on delete set null,
  is_incident boolean not null default false,
  ts timestamptz not null default now()
);

create index if not exists sal_org_idx on sales_activity_log(org_id);
create index if not exists sal_lead_idx on sales_activity_log(lead_id);
create index if not exists sal_actor_idx on sales_activity_log(actor_id);
create index if not exists sal_incident_idx on sales_activity_log(is_incident) where is_incident = true;

create table if not exists sales_activity_attachments (
  id uuid primary key default uuid_generate_v4(),
  log_id uuid not null references sales_activity_log(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  file_url text not null,
  file_type text not null,
  label text,
  uploaded_by uuid not null references auth.users(id),
  ts timestamptz not null default now()
);

create table if not exists sales_activity_signoffs (
  id uuid primary key default uuid_generate_v4(),
  log_id uuid not null references sales_activity_log(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  manager_id uuid not null references auth.users(id),
  action signoff_action not null,
  note text,
  ts timestamptz not null default now()
);

create table if not exists payment_records (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  method payment_method not null,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'succeeded', 'failed')) default 'pending',
  receipt_url text,
  created_at timestamptz not null default now()
);

-- Append-only trigger
create or replace function prevent_sal_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'sales_activity_log is append-only';
end;
$$;

drop trigger if exists sal_no_update on sales_activity_log;
drop trigger if exists sal_no_delete on sales_activity_log;
create trigger sal_no_update before update on sales_activity_log for each row execute function prevent_sal_mutation();
create trigger sal_no_delete before delete on sales_activity_log for each row execute function prevent_sal_mutation();

-- ─── FCC AT&T locations ───────────────────────────────────────────────────────
create table if not exists fcc_att_locations (
  id bigserial primary key,
  geom geometry(Point, 4326) not null,
  address text,
  city text,
  state text,
  tech_code integer,
  max_down_mbps numeric,
  max_up_mbps numeric
);

create index if not exists fcc_att_locations_geom_idx on fcc_att_locations using gist(geom);

create or replace function fcc_att_available(lat double precision, lng double precision, radius_m integer default 100)
returns boolean language sql stable as $$
  select exists (
    select 1 from fcc_att_locations
    where st_dwithin(geom::geography, st_makepoint(lng, lat)::geography, radius_m)
    limit 1
  );
$$;

-- ─── Invites ──────────────────────────────────────────────────────────────────
create table if not exists invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  role user_role not null default 'sales_rep',
  team_id uuid references teams(id) on delete set null,
  token text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Onboarding documents ─────────────────────────────────────────────────────
create table if not exists onboarding_document_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  doc_type text not null,
  title text not null,
  description text,
  required boolean not null default true,
  enabled boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(org_id, doc_type)
);

create table if not exists onboarding_document_submissions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references onboarding_document_templates(id) on delete cascade,
  form_data jsonb not null default '{}',
  signature_name text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  unique(user_id, template_id)
);

-- ─── Compensation ─────────────────────────────────────────────────────────────
create table if not exists packages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  speed_mbps integer,
  payout_amount numeric(10,2) not null,
  active boolean not null default true,
  display_order smallint not null default 0,
  category text not null default 'new' check (category in ('new', 'migration', 'mobility', 'insurance')),
  base_comp numeric(10,2),
  vir_incentive numeric(10,2) default 0,
  chargeback_days integer not null default 90,
  created_at timestamptz not null default now(),
  unique(org_id, name)
);

create table if not exists sales_tiers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  commission_pct numeric(5,2) not null,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(org_id, name)
);

alter table user_profiles add column if not exists sales_tier_id uuid references sales_tiers(id) on delete set null;

create table if not exists sales_goals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  period_type text not null check (period_type in ('weekly','monthly')),
  min_sales_count integer not null default 0,
  min_revenue numeric(10,2),
  team_lead_bonus numeric(10,2),
  assigned_by uuid references auth.users(id) on delete set null,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now()
);

create index if not exists goals_user_idx on sales_goals(user_id);
create index if not exists goals_team_idx on sales_goals(team_id);

-- ─── Payroll ──────────────────────────────────────────────────────────────────
create table if not exists pay_periods (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(org_id, period_start)
);

create table if not exists paystubs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pay_period_id uuid not null references pay_periods(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_type text not null check (pay_type in ('hourly','commission')),
  hourly_rate numeric(10,2),
  hours_worked numeric(6,2),
  gross_commission numeric(10,2) not null default 0,
  chargebacks numeric(10,2) not null default 0,
  bonus numeric(10,2) not null default 0,
  net_pay numeric(10,2) not null default 0,
  line_items jsonb not null default '[]',
  sales_count integer not null default 0,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','released')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  released_at timestamptz,
  manager_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, pay_period_id)
);

create table if not exists chargebacks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  sale_log_id uuid references sales_activity_log(id) on delete set null,
  payout_amount numeric(10,2) not null,
  reason text,
  applied_to_stub uuid references paystubs(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists bonus_goals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  bonus_amount numeric(10,2) not null,
  target_sales_count integer,
  target_revenue numeric(10,2),
  period_type text not null default 'weekly' check (period_type in ('weekly','monthly')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── RLS (enable on all tables, policies where missing) ───────────────────────
alter table orgs enable row level security;
alter table teams enable row level security;
alter table user_profiles enable row level security;
alter table team_members enable row level security;
alter table leads enable row level security;
alter table lead_status_history enable row level security;
alter table tags enable row level security;
alter table lead_tags enable row level security;
alter table lead_notes enable row level security;
alter table opt_out_addresses enable row level security;
alter table qr_codes enable row level security;
alter table ai_usage enable row level security;
alter table ai_prompt_logs enable row level security;
alter table sales_activity_log enable row level security;
alter table sales_activity_attachments enable row level security;
alter table sales_activity_signoffs enable row level security;
alter table payment_records enable row level security;
alter table invites enable row level security;
alter table onboarding_document_templates enable row level security;
alter table onboarding_document_submissions enable row level security;
alter table packages enable row level security;
alter table sales_tiers enable row level security;
alter table sales_goals enable row level security;
alter table pay_periods enable row level security;
alter table paystubs enable row level security;
alter table chargebacks enable row level security;
alter table bonus_goals enable row level security;

-- Helper functions
create or replace function my_org_id() returns uuid language sql stable as $$
  select org_id from user_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function my_role() returns user_role language sql stable as $$
  select role from user_profiles where user_id = auth.uid() limit 1;
$$;

-- Core RLS policies (drop + recreate to be idempotent)
do $$ begin
  -- Orgs
  drop policy if exists "org members can read" on orgs;
  create policy "org members can read" on orgs for select using (id = my_org_id());

  -- Profiles
  drop policy if exists "profiles: read org" on user_profiles;
  drop policy if exists "profiles: update own" on user_profiles;
  drop policy if exists "profiles: insert own" on user_profiles;
  create policy "profiles: read org" on user_profiles for select using (org_id = my_org_id());
  create policy "profiles: update own" on user_profiles for update using (user_id = auth.uid());
  create policy "profiles: insert own" on user_profiles for insert with check (user_id = auth.uid());

  -- Teams
  drop policy if exists "teams: read org" on teams;
  create policy "teams: read org" on teams for select using (org_id = my_org_id());

  -- Leads
  drop policy if exists "leads: read" on leads;
  drop policy if exists "leads: insert" on leads;
  drop policy if exists "leads: update" on leads;
  create policy "leads: read" on leads for select using (org_id = my_org_id() and (my_role() in ('admin','sales_manager','team_lead') or assigned_to = auth.uid() or assigned_to is null));
  create policy "leads: insert" on leads for insert with check (org_id = my_org_id());
  create policy "leads: update" on leads for update using (org_id = my_org_id());

  -- Sales log
  drop policy if exists "sal: read" on sales_activity_log;
  drop policy if exists "sal: insert" on sales_activity_log;
  create policy "sal: read" on sales_activity_log for select using (org_id = my_org_id());
  create policy "sal: insert" on sales_activity_log for insert with check (org_id = my_org_id() and actor_id = auth.uid());

  -- Packages
  drop policy if exists "packages: org read" on packages;
  drop policy if exists "packages: admin write" on packages;
  create policy "packages: org read" on packages for select using (org_id = my_org_id());
  create policy "packages: admin write" on packages for all using ((select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager'));

  -- Sales tiers
  drop policy if exists "tiers: org read" on sales_tiers;
  drop policy if exists "tiers: admin write" on sales_tiers;
  create policy "tiers: org read" on sales_tiers for select using (org_id = my_org_id());
  create policy "tiers: admin write" on sales_tiers for all using ((select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager'));

  -- Pay periods
  drop policy if exists "pay_periods: org read" on pay_periods;
  drop policy if exists "pay_periods: manager write" on pay_periods;
  create policy "pay_periods: org read" on pay_periods for select using (org_id = my_org_id());
  create policy "pay_periods: manager write" on pay_periods for all using (org_id = my_org_id() and (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager'));

  -- Paystubs
  drop policy if exists "paystubs: read" on paystubs;
  drop policy if exists "paystubs: manager write" on paystubs;
  create policy "paystubs: read" on paystubs for select using (org_id = my_org_id() and (user_id = auth.uid() or (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager','team_lead')));
  create policy "paystubs: manager write" on paystubs for all using (org_id = my_org_id() and (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager'));

  -- Chargebacks
  drop policy if exists "chargebacks: org read" on chargebacks;
  drop policy if exists "chargebacks: manager write" on chargebacks;
  create policy "chargebacks: org read" on chargebacks for select using (org_id = my_org_id());
  create policy "chargebacks: manager write" on chargebacks for all using (org_id = my_org_id() and (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager','team_lead'));

  -- Bonus goals
  drop policy if exists "bonus_goals: org read" on bonus_goals;
  drop policy if exists "bonus_goals: manager write" on bonus_goals;
  create policy "bonus_goals: org read" on bonus_goals for select using (org_id = my_org_id());
  create policy "bonus_goals: manager write" on bonus_goals for all using (org_id = my_org_id() and (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager'));

  -- Invites
  drop policy if exists "invites: org read" on invites;
  drop policy if exists "invites: manager write" on invites;
  create policy "invites: org read" on invites for select using (org_id = my_org_id());
  create policy "invites: manager write" on invites for all using (org_id = my_org_id() and (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager','team_lead'));

  -- Onboarding docs
  drop policy if exists "doc_templates: org read" on onboarding_document_templates;
  create policy "doc_templates: org read" on onboarding_document_templates for select using (org_id = my_org_id());
  drop policy if exists "doc_submissions: own" on onboarding_document_submissions;
  create policy "doc_submissions: own" on onboarding_document_submissions for all using (org_id = my_org_id() and (user_id = auth.uid() or (select role from user_profiles where user_id = auth.uid() limit 1) in ('admin','sales_manager','team_lead')));

exception when others then
  raise notice 'Policy error: %', sqlerrm;
end $$;

-- Grant authenticated access
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
