-- Add avatar_url to user_profiles for leaderboard / bonus board display
alter table user_profiles
  add column if not exists avatar_url text;

-- Reps can update their own avatar_url
-- (upload handled via Supabase storage, URL stored here)
