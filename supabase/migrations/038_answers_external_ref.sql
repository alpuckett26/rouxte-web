-- 038: external references for cross-system lead sync (Anseur/Answers integration).
-- external_source identifies the upstream system ('answers'); external_ref is the
-- upstream primary key (Answers restaurant_id). Dedupe key for synced leads.
-- Address-based dedupe (org_id, address) remains for organic/manual imports.

alter table leads add column if not exists external_source text;
alter table leads add column if not exists external_ref text;

create unique index if not exists leads_org_external_ref_uniq
  on leads (org_id, external_source, external_ref)
  where external_ref is not null;

comment on column leads.external_source is 'Upstream system that owns this lead record (e.g. ''answers'')';
comment on column leads.external_ref is 'Primary key in the upstream system (Answers restaurant_id)';
