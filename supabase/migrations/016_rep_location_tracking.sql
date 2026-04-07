-- Rep GPS location for manager live-tracking
create table rep_locations (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references orgs(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    real,
  updated_at  timestamptz not null default now()
);

alter table rep_locations enable row level security;

-- Reps can upsert their own location
create policy "rep_locations: upsert own" on rep_locations
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id = my_org_id());

-- Managers/admins can read all locations in their org
create policy "rep_locations: manager read" on rep_locations
  for select using (
    org_id = my_org_id() and my_role() in ('admin', 'sales_manager', 'team_lead')
  );
