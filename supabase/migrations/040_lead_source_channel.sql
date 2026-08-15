-- Attribution: where a lead actually came from (rouxte-web#16, the optional leg).
--
-- The chain measured in the war room 2026-08-14: the printed bag-card token
-- (?src=qrbagcard) is CARRIED correctly by the generated site, survives to the
-- ORDER action — and then dies, because the CRM had no column to land it in.
-- Rouxte's leg of that hole is this column. The spine does not forward `src`
-- yet; when it does, upsertLead already lands it (write is conditional on the
-- payload actually carrying a token, so this migration changes nothing until
-- then).
--
-- Deliberately NOT reusing the existing `qr_codes` table: that is the
-- door-knock QR surface and is unrelated to the bag card. Nobody should later
-- "discover" QR plumbing here and assume the card is wired to it.

alter table leads add column if not exists source_channel text;

create index if not exists leads_org_source_channel_idx
  on leads (org_id, source_channel)
  where source_channel is not null;

comment on column leads.source_channel is
  'Attribution token for the surface that produced this lead (e.g. ''qrbagcard''). Distinct from leads.source, which names the upstream system.';
