-- Shadow sessions log
create table if not exists shadow_sessions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  rep_id        uuid not null references auth.users(id) on delete cascade,
  mentor_id     uuid not null references auth.users(id),
  session_date  date not null,
  duration_hrs  numeric(4,1),
  notes         text,
  logged_by     uuid references auth.users(id),
  manager_approved  boolean not null default false,
  approved_by   uuid references auth.users(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

alter table shadow_sessions enable row level security;

create policy "shadow_sessions_read" on shadow_sessions for select
  using (org_id = my_org_id());

create policy "shadow_sessions_insert" on shadow_sessions for insert
  with check (org_id = my_org_id() and my_role() in ('admin', 'sales_manager', 'team_lead'));

create policy "shadow_sessions_update" on shadow_sessions for update
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager', 'team_lead'));

create policy "shadow_sessions_delete" on shadow_sessions for delete
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager'));

-- Field clearance on user_profiles
alter table user_profiles
  add column if not exists field_cleared     boolean not null default false,
  add column if not exists field_cleared_by  uuid references auth.users(id),
  add column if not exists field_cleared_at  timestamptz;
