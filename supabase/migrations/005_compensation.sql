-- ─── Packages (product catalog) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name           text NOT NULL,
  speed_mbps     integer,
  payout_amount  numeric(10,2) NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  display_order  smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages: org read"   ON packages FOR SELECT TO authenticated USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "packages: admin write" ON packages FOR ALL    TO authenticated USING (
  (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON packages TO authenticated;

-- ─── Sales Commission Tiers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_tiers (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name           text NOT NULL,            -- 'Tier 1', 'Tier 2', 'Tier 3'
  commission_pct numeric(5,2) NOT NULL,    -- percentage of payout e.g. 10.00
  display_order  smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

ALTER TABLE sales_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers: org read"    ON sales_tiers FOR SELECT TO authenticated USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "tiers: admin write" ON sales_tiers FOR ALL    TO authenticated USING (
  (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_tiers TO authenticated;

-- ─── Add tier + standing to user_profiles ─────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS sales_tier_id uuid REFERENCES sales_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS standing text NOT NULL DEFAULT 'active'
    CHECK (standing IN ('active','warning','remedial_training','probation'));

-- ─── Sales Goals ─────────────────────────────────────────────────────────────
-- Goals can be assigned to an individual rep (user_id) OR a whole team (team_id).
-- Team goals trigger a team_lead_bonus if the team hits the goal.

CREATE TABLE IF NOT EXISTS sales_goals (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id           uuid REFERENCES teams(id) ON DELETE CASCADE,
  period_type       text NOT NULL CHECK (period_type IN ('weekly','monthly')),
  min_sales_count   integer NOT NULL DEFAULT 0,
  min_revenue       numeric(10,2),           -- optional revenue floor
  team_lead_bonus   numeric(10,2),           -- bonus paid to team lead if team hits goal
  assigned_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_from    date NOT NULL DEFAULT current_date,
  effective_to      date,                    -- null = ongoing
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_target_check CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS goals_user_idx ON sales_goals(user_id);
CREATE INDEX IF NOT EXISTS goals_team_idx ON sales_goals(team_id);

ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals: org read" ON sales_goals FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "goals: manager write" ON sales_goals FOR ALL TO authenticated USING (
  (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager','team_lead')
);
GRANT SELECT, INSERT, UPDATE ON sales_goals TO authenticated;
