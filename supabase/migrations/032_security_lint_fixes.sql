-- Migration 032: Fix Supabase security linter errors
-- 1. lead_activity_ratio: recreate with security_invoker so caller's RLS applies
-- 2. fcc_att_blocks / fcc_att_locations: enable RLS + public read policy (reference data)
-- 3. spatial_ref_sys: enable RLS with no policies (blocks direct PostgREST access to PostGIS system table)
-- 4. team_tiers: enable RLS with org-scoped policies

-- ── 1. lead_activity_ratio — security_invoker ──────────────────────────────
DROP VIEW IF EXISTS lead_activity_ratio;

CREATE VIEW lead_activity_ratio
  WITH (security_invoker = true)
AS
SELECT
  org_id,
  assigned_to,
  assigned_at,
  COUNT(*)                                                                  AS total_leads,
  COUNT(*) FILTER (WHERE status <> 'new')                                  AS worked_leads,
  ROUND(COUNT(*) FILTER (WHERE status <> 'new') * 100.0 / COUNT(*), 1)    AS worked_pct,
  NOW() - MIN(assigned_at)                                                 AS oldest_assignment_age
FROM leads
WHERE assigned_to IS NOT NULL
  AND assigned_at IS NOT NULL
  AND cooldown_until IS NULL
GROUP BY org_id, assigned_to, assigned_at;

-- ── 2. fcc_att_locations — RLS with public read ────────────────────────────
ALTER TABLE fcc_att_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcc_att_locations_public_read"
  ON fcc_att_locations FOR SELECT
  USING (true);

-- ── 3. fcc_att_blocks — RLS with public read ──────────────────────────────
ALTER TABLE fcc_att_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcc_att_blocks_public_read"
  ON fcc_att_blocks FOR SELECT
  USING (true);

-- spatial_ref_sys is owned by the PostGIS extension — cannot enable RLS (known Supabase false positive)

-- ── 4. team_tiers — org-scoped RLS ────────────────────────────────────────
ALTER TABLE team_tiers ENABLE ROW LEVEL SECURITY;

-- Members of the org can read tier info
CREATE POLICY "team_tiers_org_read"
  ON team_tiers FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Only admins / sales_managers can write tier records
CREATE POLICY "team_tiers_manager_write"
  ON team_tiers FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales_manager')
    )
  );
