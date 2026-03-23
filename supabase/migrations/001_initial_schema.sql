-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type user_role as enum ('admin', 'sales_manager', 'team_lead', 'sales_rep');

create type lead_status as enum (
  'new', 'attempted', 'contacted', 'qualified',
  'appointment_set', 'sold', 'installed', 'closed_lost'
);

create type onboarding_step as enum ('verify', 'promo', 'profile', 'complete');

create type payment_method as enum ('card', 'cashapp', 'paypal', 'invoice', 'company_plan');

create type log_event_type as enum (
  'lead_assigned', 'lead_unassigned', 'status_changed', 'note_added',
  'appointment_set', 'appointment_missed', 'appointment_completed',
  'sale_submitted', 'sale_verified', 'sale_rejected',
  'no_solicit_observed', 'do_not_knock_marked', 'complaint_received',
  'law_enforcement_contact', 'trespass_warning',
  'manager_acknowledged', 'manager_approved', 'manager_denied',
  'coach_note_added', 'incident_reviewed'
);

create type signoff_action as enum ('acknowledged', 'approved', 'denied');

-- ─── Orgs ────────────────────────────────────────────────────────────────────
create table orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ─── Teams ───────────────────────────────────────────────────────────────────
create table teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  tier int not null default 1,
  benefits jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── User Profiles ────────────────────────────────────────────────────────────
create table user_profiles (
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

-- ─── Team Members ─────────────────────────────────────────────────────────────
create table team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role user_role not null default 'sales_rep',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

-- ─── Leads ───────────────────────────────────────────────────────────────────
create table leads (
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

create index leads_org_idx on leads(org_id);
create index leads_status_idx on leads(status);
create index leads_assigned_idx on leads(assigned_to);

-- ─── Lead Status History ──────────────────────────────────────────────────────
create table lead_status_history (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  from_status lead_status,
  to_status lead_status not null,
  changed_by uuid not null references auth.users(id),
  ts timestamptz not null default now()
);

-- ─── Tags ────────────────────────────────────────────────────────────────────
create table tags (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  color text not null default 'gray',
  unique(org_id, name)
);

-- Seed default tags
-- (run after org creation via application code)

create table lead_tags (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  ts timestamptz not null default now(),
  unique(lead_id, tag_id)
);

-- ─── Lead Notes ──────────────────────────────────────────────────────────────
create table lead_notes (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  ts timestamptz not null default now()
);

-- ─── Compliance ──────────────────────────────────────────────────────────────
create table opt_out_addresses (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  normalized_address text not null,
  lead_id uuid references leads(id) on delete set null,
  source text not null check (source in ('qr', 'manual')),
  ts timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique(org_id, normalized_address)
);

create table qr_codes (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text not null unique,
  campaign text,
  created_at timestamptz not null default now()
);

-- ─── AI ──────────────────────────────────────────────────────────────────────
create table ai_usage (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  prompts_used int not null default 0,
  total_prompts_used int not null default 0,
  unique(user_id, date)
);

create table team_tiers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  tier int not null default 1,
  benefits jsonb not null default '{}',
  member_count int not null default 0,
  unique(team_id)
);

create table ai_prompt_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  prompt_type text not null,
  tokens int not null default 0,
  ts timestamptz not null default now()
);

-- ─── Sales Logger (append-only) ───────────────────────────────────────────────
create table sales_activity_log (
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

create index sal_org_idx on sales_activity_log(org_id);
create index sal_lead_idx on sales_activity_log(lead_id);
create index sal_actor_idx on sales_activity_log(actor_id);
create index sal_incident_idx on sales_activity_log(is_incident) where is_incident = true;

create table sales_activity_attachments (
  id uuid primary key default uuid_generate_v4(),
  log_id uuid not null references sales_activity_log(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  file_url text not null,
  file_type text not null,
  label text,
  uploaded_by uuid not null references auth.users(id),
  ts timestamptz not null default now()
);

create table sales_activity_signoffs (
  id uuid primary key default uuid_generate_v4(),
  log_id uuid not null references sales_activity_log(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  manager_id uuid not null references auth.users(id),
  action signoff_action not null,
  note text,
  ts timestamptz not null default now()
);

-- ─── Payments ────────────────────────────────────────────────────────────────
create table payment_records (
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

-- ─── Append-only trigger on sales_activity_log ────────────────────────────────
create or replace function prevent_sal_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'sales_activity_log is append-only — UPDATE and DELETE are not permitted';
end;
$$;

create trigger sal_no_update
  before update on sales_activity_log
  for each row execute function prevent_sal_mutation();

create trigger sal_no_delete
  before delete on sales_activity_log
  for each row execute function prevent_sal_mutation();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
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

-- Helper: get caller's org_id
create or replace function my_org_id()
returns uuid language sql stable as $$
  select org_id from user_profiles where user_id = auth.uid() limit 1;
$$;

-- Helper: get caller's role
create or replace function my_role()
returns user_role language sql stable as $$
  select role from user_profiles where user_id = auth.uid() limit 1;
$$;

-- Orgs: members can read their own org
create policy "org members can read" on orgs
  for select using (id = my_org_id());

-- User profiles: read own org; update own profile
create policy "profiles: read org" on user_profiles
  for select using (org_id = my_org_id());

create policy "profiles: update own" on user_profiles
  for update using (user_id = auth.uid());

create policy "profiles: insert own" on user_profiles
  for insert with check (user_id = auth.uid());

-- Teams
create policy "teams: read org" on teams
  for select using (org_id = my_org_id());

-- Leads: reps see assigned or org-wide (configurable); managers/admins see all in org
create policy "leads: read" on leads
  for select using (
    org_id = my_org_id() and (
      my_role() in ('admin', 'sales_manager', 'team_lead')
      or assigned_to = auth.uid()
      or assigned_to is null
    )
  );

create policy "leads: insert" on leads
  for insert with check (org_id = my_org_id());

create policy "leads: update" on leads
  for update using (org_id = my_org_id());

-- Lead notes/tags/history: org members
create policy "lead_notes: read" on lead_notes
  for select using (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );
create policy "lead_notes: insert" on lead_notes
  for insert with check (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );

create policy "lead_tags: read" on lead_tags
  for select using (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );
create policy "lead_tags: insert" on lead_tags
  for insert with check (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );

create policy "lead_status_history: read" on lead_status_history
  for select using (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );
create policy "lead_status_history: insert" on lead_status_history
  for insert with check (
    exists (select 1 from leads where id = lead_id and org_id = my_org_id())
  );

-- Tags
create policy "tags: org" on tags
  for all using (org_id = my_org_id()) with check (org_id = my_org_id());

-- Sales Logger: read by org members
create policy "sal: read" on sales_activity_log
  for select using (org_id = my_org_id());

create policy "sal: insert" on sales_activity_log
  for insert with check (org_id = my_org_id() and actor_id = auth.uid());

create policy "sal_attach: read" on sales_activity_attachments
  for select using (org_id = my_org_id());
create policy "sal_attach: insert" on sales_activity_attachments
  for insert with check (org_id = my_org_id());

create policy "sal_signoff: read" on sales_activity_signoffs
  for select using (org_id = my_org_id());
create policy "sal_signoff: insert" on sales_activity_signoffs
  for insert with check (
    org_id = my_org_id()
    and manager_id = auth.uid()
    and my_role() in ('admin', 'sales_manager', 'team_lead')
  );

-- Opt-out: org members read; anyone can write (handled via service role in edge fn)
create policy "optout: read" on opt_out_addresses
  for select using (org_id = my_org_id());

-- AI usage: own records
create policy "ai_usage: own" on ai_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai_usage: managers read team" on ai_usage
  for select using (
    org_id = my_org_id()
    and my_role() in ('admin', 'sales_manager', 'team_lead')
  );

-- Payments: own records; admins see all
create policy "payments: own" on payment_records
  for select using (
    user_id = auth.uid()
    or (org_id = my_org_id() and my_role() = 'admin')
  );
