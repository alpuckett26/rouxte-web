create table notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid not null references orgs(id)       on delete cascade,
  type         text not null,
  title        text not null,
  body         text not null,
  data         jsonb not null default '{}',
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_unread_idx
  on notifications(user_id, created_at desc)
  where read_at is null;

alter table notifications enable row level security;

create policy "notifications: read own" on notifications
  for select using (user_id = auth.uid());

create policy "notifications: update own" on notifications
  for update using (user_id = auth.uid());
