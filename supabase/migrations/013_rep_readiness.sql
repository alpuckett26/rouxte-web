-- Rep Field Readiness Checklist
-- Tracks physical/equipment/training items team leads verify per rep

create table if not exists readiness_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id) on delete cascade,  -- null = global default
  label        text not null,
  description  text,
  category     text not null default 'general',  -- appearance, documentation, training, field_setup
  order_index  int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists readiness_checks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     uuid not null references readiness_items(id) on delete cascade,
  checked_by  uuid references auth.users(id),
  checked_at  timestamptz not null default now(),
  notes       text,
  unique(user_id, item_id)
);

-- RLS
alter table readiness_items enable row level security;
alter table readiness_checks enable row level security;

create policy "readiness_items_read" on readiness_items for select
  using (org_id is null or org_id = my_org_id());

create policy "readiness_items_manage" on readiness_items for all
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager', 'team_lead'));

create policy "readiness_checks_read" on readiness_checks for select
  using (org_id = my_org_id());

create policy "readiness_checks_manage" on readiness_checks for all
  using (org_id = my_org_id() and my_role() in ('admin', 'sales_manager', 'team_lead'));

-- Global default items (org_id = null, available to all orgs)
insert into readiness_items (org_id, label, description, category, order_index) values
  -- Appearance
  (null, 'Company shirt', 'Correct size, clean, no wrinkles', 'appearance', 1),
  (null, 'Photo ID badge', 'Issued by manager, worn visibly', 'appearance', 2),
  (null, 'Business cards', 'Has printed business cards to leave at door', 'appearance', 3),
  -- Documentation
  (null, 'Background check cleared', 'Passed required background screening', 'documentation', 10),
  (null, 'W-9 / tax forms submitted', 'All HR tax paperwork on file', 'documentation', 11),
  (null, 'Non-solicitation policy signed', 'Acknowledges no-solicitation rules and territory limits', 'documentation', 12),
  (null, 'Sales agreement signed', 'Independent contractor or employment agreement on file', 'documentation', 13),
  -- Training
  (null, 'All training modules completed', 'Finished every module in the app training flow', 'training', 20),
  (null, 'Product knowledge quiz passed', 'Scored 100% on AT&T fiber product quiz', 'training', 21),
  (null, 'Shadowed experienced rep', 'Completed at least one full day shadowing a senior rep', 'training', 22),
  (null, 'Attended team huddle', 'Present at team meeting before first solo shift', 'training', 23),
  -- Field Setup
  (null, 'App installed and logged in', 'Rouxte app installed on device, account active', 'field_setup', 30),
  (null, 'Device charged and working', 'Tablet or phone ready for the field', 'field_setup', 31),
  (null, 'Territory assignment confirmed', 'Knows their assigned area and reporting manager', 'field_setup', 32);
