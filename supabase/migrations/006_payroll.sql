-- ─── Trial / graduation fields on user_profiles ──────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS hourly_rate       numeric(10,2),
  ADD COLUMN IF NOT EXISTS total_sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_started_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS graduated_at      timestamptz;   -- set when total_sales_count hits 10

-- ─── Pay Periods ─────────────────────────────────────────────────────────────
-- One record per org per weekly pay cycle (Mon – Sun).
CREATE TABLE IF NOT EXISTS pay_periods (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','generating','closed')),
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, period_start)
);

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_periods: org read" ON pay_periods FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "pay_periods: manager write" ON pay_periods FOR ALL TO authenticated USING (
  (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager')
);
GRANT SELECT, INSERT, UPDATE ON pay_periods TO authenticated;

-- ─── Paystubs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paystubs (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_period_id    uuid NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  pay_type         text NOT NULL CHECK (pay_type IN ('hourly','commission')),
  -- Hourly
  hourly_rate      numeric(10,2),
  hours_worked     numeric(8,2),
  -- Commission
  gross_commission numeric(10,2) NOT NULL DEFAULT 0,
  -- Adjustments
  chargebacks      numeric(10,2) NOT NULL DEFAULT 0,  -- always positive (deduction)
  bonus            numeric(10,2) NOT NULL DEFAULT 0,
  -- Net
  net_pay          numeric(10,2) NOT NULL DEFAULT 0,
  -- Detail
  line_items       jsonb NOT NULL DEFAULT '[]',
  sales_count      integer NOT NULL DEFAULT 0,
  -- Status
  status           text NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval','approved','released')),
  approved_by      uuid REFERENCES auth.users(id),
  approved_at      timestamptz,
  released_at      timestamptz,
  manager_notes    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pay_period_id)
);

CREATE INDEX IF NOT EXISTS paystubs_user_idx   ON paystubs(user_id);
CREATE INDEX IF NOT EXISTS paystubs_period_idx ON paystubs(pay_period_id);
CREATE INDEX IF NOT EXISTS paystubs_org_idx    ON paystubs(org_id);

ALTER TABLE paystubs ENABLE ROW LEVEL SECURITY;

-- Reps can only see their own released stubs
CREATE POLICY "paystubs: own released read" ON paystubs FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'released');

-- Managers see all stubs in org
CREATE POLICY "paystubs: manager read" ON paystubs FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager','team_lead')
  );

CREATE POLICY "paystubs: manager write" ON paystubs FOR ALL TO authenticated USING (
  org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager')
);
GRANT SELECT, INSERT, UPDATE ON paystubs TO authenticated;

-- ─── Chargebacks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chargebacks (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  sale_log_id      uuid,               -- references sales_activity_log.id
  payout_amount    numeric(10,2) NOT NULL,   -- full sale payout clawed back
  reason           text,
  applied_to_stub  uuid REFERENCES paystubs(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chargebacks_user_idx ON chargebacks(user_id);
CREATE INDEX IF NOT EXISTS chargebacks_org_idx  ON chargebacks(org_id);

ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chargebacks: manager write" ON chargebacks FOR ALL TO authenticated USING (
  org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager','team_lead')
);
CREATE POLICY "chargebacks: own read" ON chargebacks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON chargebacks TO authenticated;

-- ─── Bonus Goals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bonus_goals (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  period_type         text NOT NULL CHECK (period_type IN ('weekly','monthly')),
  target_sales_count  integer,
  target_revenue      numeric(10,2),
  bonus_amount        numeric(10,2) NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bonus_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_goals: org read" ON bonus_goals FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "bonus_goals: manager write" ON bonus_goals FOR ALL TO authenticated USING (
  org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager')
);
GRANT SELECT, INSERT, UPDATE ON bonus_goals TO authenticated;
