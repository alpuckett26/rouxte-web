-- Add termination tracking to user_profiles
alter table user_profiles
  add column if not exists terminated_at timestamptz,
  add column if not exists terminated_by uuid references auth.users(id) on delete set null;
