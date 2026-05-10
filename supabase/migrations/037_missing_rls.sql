-- Migration 037: Add missing RLS policies
-- Several tables had RLS enabled (from migration 000) but no policies defined,
-- meaning all authenticated reads/writes were silently denied for the app user
-- client. The admin/service-role client bypassed these, but we add policies
-- here for defense-in-depth and to allow future direct queries.

-- ── tags ────────────────────────────────────────────────────────────────────────────
drop policy if exists "tags: org read"     on tags;
drop policy if exists "tags: manager write" on tags;
create policy "tags: org read"     on tags for select using (org_id = my_org_id());
create policy "tags: manager write" on tags for all
  using  (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'))
  with check (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'));

-- ── lead_status_history ─────────────────────────────────────────────────────
-- No direct org_id; join through leads.
drop policy if exists "lead_status_history: org read" on lead_status_history;
drop policy if exists "lead_status_history: org insert" on lead_status_history;
create policy "lead_status_history: org read" on lead_status_history for select
  using (exists (select 1 from leads where id = lead_status_history.lead_id and org_id = my_org_id()));
create policy "lead_status_history: org insert" on lead_status_history for insert
  with check (exists (select 1 from leads where id = lead_status_history.lead_id and org_id = my_org_id())
              and changed_by = auth.uid());

-- ── lead_tags ─────────────────────────────────────────────────────────────────────────
drop policy if exists "lead_tags: org read"   on lead_tags;
drop policy if exists "lead_tags: org write"  on lead_tags;
create policy "lead_tags: org read"  on lead_tags for select
  using (exists (select 1 from leads where id = lead_tags.lead_id and org_id = my_org_id()));
create policy "lead_tags: org write" on lead_tags for all
  using (exists (select 1 from leads where id = lead_tags.lead_id and org_id = my_org_id()))
  with check (exists (select 1 from leads where id = lead_tags.lead_id and org_id = my_org_id())
              and assigned_by = auth.uid());

-- ── lead_notes ──────────────────────────────────────────────────────────────────────────
drop policy if exists "lead_notes: org read"    on lead_notes;
drop policy if exists "lead_notes: own write"   on lead_notes;
create policy "lead_notes: org read"  on lead_notes for select
  using (exists (select 1 from leads where id = lead_notes.lead_id and org_id = my_org_id()));
create policy "lead_notes: own write" on lead_notes for insert
  with check (exists (select 1 from leads where id = lead_notes.lead_id and org_id = my_org_id())
              and author_id = auth.uid());

-- ── opt_out_addresses ─────────────────────────────────────────────────────────────────
drop policy if exists "opt_out: org read"       on opt_out_addresses;
drop policy if exists "opt_out: manager write"  on opt_out_addresses;
create policy "opt_out: org read"      on opt_out_addresses for select
  using (org_id = my_org_id());
create policy "opt_out: manager write" on opt_out_addresses for all
  using  (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'))
  with check (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'));

-- ── qr_codes ──────────────────────────────────────────────────────────────────────────────
drop policy if exists "qr_codes: org read"      on qr_codes;
drop policy if exists "qr_codes: manager write" on qr_codes;
create policy "qr_codes: org read"      on qr_codes for select using (org_id = my_org_id());
create policy "qr_codes: manager write" on qr_codes for all
  using  (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'))
  with check (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'));

-- ── ai_usage ──────────────────────────────────────────────────────────────────────────────
drop policy if exists "ai_usage: own read"     on ai_usage;
drop policy if exists "ai_usage: manager read" on ai_usage;
drop policy if exists "ai_usage: own insert"   on ai_usage;
create policy "ai_usage: own read"     on ai_usage for select
  using (user_id = auth.uid());
create policy "ai_usage: manager read" on ai_usage for select
  using (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'));
create policy "ai_usage: own insert"   on ai_usage for insert
  with check (user_id = auth.uid() and org_id = my_org_id());
create policy "ai_usage: own update"   on ai_usage for update
  using (user_id = auth.uid());

-- ── ai_prompt_logs ────────────────────────────────────────────────────────────────────────────
drop policy if exists "ai_prompt_logs: own read"     on ai_prompt_logs;
drop policy if exists "ai_prompt_logs: manager read" on ai_prompt_logs;
drop policy if exists "ai_prompt_logs: own insert"   on ai_prompt_logs;
create policy "ai_prompt_logs: own read"     on ai_prompt_logs for select
  using (user_id = auth.uid());
create policy "ai_prompt_logs: manager read" on ai_prompt_logs for select
  using (org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead'));
create policy "ai_prompt_logs: own insert"   on ai_prompt_logs for insert
  with check (user_id = auth.uid() and org_id = my_org_id());

-- ── sales_activity_attachments ────────────────────────────────────────────────────────────────
-- No direct org_id; join through sales_activity_log.
drop policy if exists "sal_attachments: org read"   on sales_activity_attachments;
drop policy if exists "sal_attachments: org insert" on sales_activity_attachments;
create policy "sal_attachments: org read" on sales_activity_attachments for select
  using (exists (select 1 from sales_activity_log where id = sales_activity_attachments.log_id and org_id = my_org_id()));
create policy "sal_attachments: org insert" on sales_activity_attachments for insert
  with check (exists (select 1 from sales_activity_log where id = sales_activity_attachments.log_id and org_id = my_org_id()));

-- ── sales_activity_signoffs ───────────────────────────────────────────────────────────────────
drop policy if exists "sal_signoffs: org read"     on sales_activity_signoffs;
drop policy if exists "sal_signoffs: manager write" on sales_activity_signoffs;
create policy "sal_signoffs: org read"      on sales_activity_signoffs for select
  using (exists (select 1 from sales_activity_log where id = sales_activity_signoffs.log_id and org_id = my_org_id()));
create policy "sal_signoffs: manager write" on sales_activity_signoffs for all
  using (exists (select 1 from sales_activity_log where id = sales_activity_signoffs.log_id and org_id = my_org_id())
         and my_role() in ('admin','sales_manager','team_lead'))
  with check (exists (select 1 from sales_activity_log where id = sales_activity_signoffs.log_id and org_id = my_org_id())
              and my_role() in ('admin','sales_manager','team_lead'));

-- ── payment_records ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "payment_records: own read"     on payment_records;
drop policy if exists "payment_records: manager read" on payment_records;
drop policy if exists "payment_records: own insert"   on payment_records;
create policy "payment_records: own read"     on payment_records for select
  using (user_id = auth.uid());
create policy "payment_records: manager read" on payment_records for select
  using (org_id = my_org_id() and my_role() in ('admin','sales_manager'));
create policy "payment_records: own insert"   on payment_records for insert
  with check (user_id = auth.uid() and org_id = my_org_id());

-- ── team_members ──────────────────────────────────────────────────────────────────────────────
-- No direct org_id; join through teams.
drop policy if exists "team_members: org read"      on team_members;
drop policy if exists "team_members: manager write" on team_members;
create policy "team_members: org read"      on team_members for select
  using (exists (select 1 from teams where id = team_members.team_id and org_id = my_org_id()));
create policy "team_members: manager write" on team_members for all
  using  (exists (select 1 from teams where id = team_members.team_id and org_id = my_org_id())
          and my_role() in ('admin','sales_manager','team_lead'))
  with check (exists (select 1 from teams where id = team_members.team_id and org_id = my_org_id())
              and my_role() in ('admin','sales_manager','team_lead'));
