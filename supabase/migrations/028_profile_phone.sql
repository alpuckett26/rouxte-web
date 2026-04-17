alter table user_profiles
  add column if not exists phone text,
  add column if not exists card_enabled boolean not null default true;
