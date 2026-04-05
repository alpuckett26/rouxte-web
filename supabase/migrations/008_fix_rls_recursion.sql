-- Fix RLS recursion: my_org_id() and my_role() query user_profiles,
-- which has RLS policies that call my_org_id()/my_role() → stack overflow.
-- SECURITY DEFINER makes them run as the function owner, bypassing RLS.

create or replace function my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from user_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from user_profiles where user_id = auth.uid() limit 1;
$$;
