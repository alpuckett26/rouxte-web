-- Add promotion eligibility tracking to user_profiles
-- A rep becomes promotion_eligible when all required training modules
-- are passed with a score of 4/5 (80%) or higher.

alter table user_profiles
  add column if not exists promotion_eligible      boolean      not null default false,
  add column if not exists promotion_eligible_at   timestamptz,
  add column if not exists promotion_eligible_by   text         default 'system'; -- 'system' | 'manager'

-- Index for fast manager queries (who on my team is eligible)
create index if not exists idx_user_profiles_promotion_eligible
  on user_profiles (org_id, promotion_eligible)
  where promotion_eligible = true;

-- Helper: check if a user has passed all training modules and flip the flag
create or replace function check_and_set_promotion_eligible(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  total_modules   int;
  passed_modules  int;
  already_set     boolean;
begin
  -- Count training modules in the org (folder = 'training')
  select count(*) into total_modules
  from training_documents
  where folder = 'training';

  -- No modules configured — nothing to gate on
  if total_modules = 0 then return; end if;

  -- Count how many this user has passed
  select count(*) into passed_modules
  from training_progress
  where user_id = p_user_id
    and quiz_passed = true
    and document_id in (
      select id from training_documents where folder = 'training'
    );

  -- Check if already flagged
  select promotion_eligible into already_set
  from user_profiles
  where user_id = p_user_id;

  if passed_modules >= total_modules and not coalesce(already_set, false) then
    update user_profiles
    set
      promotion_eligible    = true,
      promotion_eligible_at = now(),
      promotion_eligible_by = 'system'
    where user_id = p_user_id;
  end if;
end;
$$;
