-- Ensure invites table has all required columns
alter table invites add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table invites add column if not exists team_id uuid references teams(id) on delete set null;
alter table invites add column if not exists role text not null default 'sales_rep';
alter table invites add column if not exists expires_at timestamptz not null default (now() + interval '7 days');
alter table invites add column if not exists accepted_at timestamptz;
