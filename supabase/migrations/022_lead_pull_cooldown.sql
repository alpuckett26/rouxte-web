-- Migration 022: Lead pull tracking + 6-month cooldown + assignment clock
-- Supports manager-initiated pull and auto-expiry cron

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_at     timestamptz,
  ADD COLUMN IF NOT EXISTS pulled_at       timestamptz,
  ADD COLUMN IF NOT EXISTS pulled_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cooldown_until  timestamptz,
  ADD COLUMN IF NOT EXISTS pull_reason     text;

-- Back-fill assigned_at for existing assigned leads (use updated_at as proxy)
UPDATE leads
SET assigned_at = updated_at
WHERE assigned_to IS NOT NULL
  AND assigned_at IS NULL;

-- Indexes for cron queries (scan by age + assignment state)
CREATE INDEX IF NOT EXISTS leads_assigned_at_idx
  ON leads(org_id, assigned_to, assigned_at)
  WHERE assigned_to IS NOT NULL AND assigned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_cooldown_idx
  ON leads(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

-- Activity ratio view used by the cron job to compute worked % per rep
-- "worked" = status moved past 'new'
CREATE OR REPLACE VIEW lead_activity_ratio AS
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
  AND cooldown_until IS NULL   -- don't count already-pulled leads
GROUP BY org_id, assigned_to, assigned_at;
