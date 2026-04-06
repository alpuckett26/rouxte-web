-- Org-level provider/service configuration
-- Makes Rouxte work for any fiber or broadband sales team, not just AT&T

alter table orgs
  add column if not exists provider_name   text not null default 'AT&T Fiber',
  add column if not exists service_type    text not null default 'fiber',  -- fiber, cable, fixed_wireless, 5g
  add column if not exists provider_color  text not null default '#00A8E0'; -- brand color for map pins

-- Policy: admins can read and update their own org
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'orgs' and policyname = 'org_read') then
    create policy "org_read" on orgs for select using (id = my_org_id());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'orgs' and policyname = 'org_update') then
    create policy "org_update" on orgs for update using (id = my_org_id() and my_role() = 'admin');
  end if;
end $$;

-- Batch FCC availability check — returns boolean[] in same order as input
create or replace function batch_fcc_check(points_json jsonb)
returns boolean[]
language plpgsql
security definer
as $$
declare
  result boolean[];
  pt jsonb;
  available boolean;
  idx int := 0;
begin
  result := array[]::boolean[];
  for pt in select * from jsonb_array_elements(points_json)
  loop
    if (pt->>'lat') is null or (pt->>'lng') is null then
      result := result || false;
    else
      select exists(
        select 1 from fcc_att_locations
        where ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_Point((pt->>'lng')::float, (pt->>'lat')::float), 4326)::geography,
          400
        )
      ) into available;
      result := result || available;
    end if;
  end loop;
  return result;
end;
$$;
