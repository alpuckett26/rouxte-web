-- Migration 033: SmartPitch Funnel
-- Gives every rep a personal public funnel link + QR code.
-- Customers complete a 7-step quiz; system scores the lead and creates a CRM entry.

-- ── lead_funnels ──────────────────────────────────────────────────────────────
CREATE TABLE lead_funnels (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rep_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug         text NOT NULL UNIQUE,
  funnel_name  text NOT NULL DEFAULT 'My Funnel',
  active       boolean NOT NULL DEFAULT true,
  scan_count   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_funnels_slug_idx ON lead_funnels (slug);
CREATE INDEX lead_funnels_rep_idx  ON lead_funnels (rep_id);
CREATE INDEX lead_funnels_org_idx  ON lead_funnels (org_id);

ALTER TABLE lead_funnels ENABLE ROW LEVEL SECURITY;

-- Reps manage their own funnel
CREATE POLICY "lead_funnels: rep own"
  ON lead_funnels FOR ALL
  USING   (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- Managers/admins read all funnels in their org
CREATE POLICY "lead_funnels: manager read"
  ON lead_funnels FOR SELECT
  USING (
    org_id = my_org_id()
    AND my_role() IN ('admin', 'sales_manager', 'team_lead')
  );

-- Public read for active funnels (needed for the unauthenticated quiz page)
CREATE POLICY "lead_funnels: public read active"
  ON lead_funnels FOR SELECT
  USING (active = true);

-- ── funnel_submissions ────────────────────────────────────────────────────────
CREATE TABLE funnel_submissions (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_id          uuid NOT NULL REFERENCES lead_funnels(id) ON DELETE CASCADE,
  rep_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id             uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  -- quiz answers
  service_interest   text,
  current_provider   text,
  pain_point         text,
  monthly_bill       text,
  switch_timeline    text,
  -- contact
  customer_name      text,
  phone              text,
  email              text,
  address            text,
  city               text,
  state_abbr         char(2),
  zip                text,
  sms_consent        boolean NOT NULL DEFAULT false,
  -- scoring
  lead_score         int NOT NULL DEFAULT 0,
  lead_temperature   text NOT NULL DEFAULT 'cold',  -- hot / warm / cold
  recommended_pitch  text,
  -- meta
  source             text NOT NULL DEFAULT 'smartpitch',
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Helpers ───────────────────────────────────────────────────────────────────

-- Atomic scan count increment (called from the public funnel page)
CREATE OR REPLACE FUNCTION increment_funnel_scan(funnel_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE lead_funnels SET scan_count = scan_count + 1 WHERE id = funnel_id;
$$;

CREATE INDEX funnel_submissions_funnel_idx ON funnel_submissions (funnel_id, created_at DESC);
CREATE INDEX funnel_submissions_rep_idx    ON funnel_submissions (rep_id, created_at DESC);
CREATE INDEX funnel_submissions_org_idx    ON funnel_submissions (org_id, created_at DESC);
CREATE INDEX funnel_submissions_temp_idx   ON funnel_submissions (org_id, lead_temperature);

ALTER TABLE funnel_submissions ENABLE ROW LEVEL SECURITY;

-- All writes go through admin client (unauthenticated customers), no INSERT policy needed
-- Reps read their own submissions
CREATE POLICY "funnel_submissions: rep read"
  ON funnel_submissions FOR SELECT
  USING (rep_id = auth.uid());

-- Managers read all in org
CREATE POLICY "funnel_submissions: manager read"
  ON funnel_submissions FOR SELECT
  USING (
    org_id = my_org_id()
    AND my_role() IN ('admin', 'sales_manager', 'team_lead')
  );
