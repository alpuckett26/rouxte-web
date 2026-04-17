CREATE TABLE quotes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rep_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  customer_name   text,
  -- Account-level settings
  total_lines        int  NOT NULL DEFAULT 1,
  autopay_paperless  boolean NOT NULL DEFAULT false,
  discount_type      text NOT NULL DEFAULT 'none', -- none | appreciation | signature
  appreciation_type  text,  -- military | first_responder | union | employee | other
  -- Line mix
  premium_lines  int NOT NULL DEFAULT 0,
  extra_lines    int NOT NULL DEFAULT 0,
  starter_lines  int NOT NULL DEFAULT 0,
  -- Line type counts
  port_in_lines  int NOT NULL DEFAULT 0,
  new_lines      int NOT NULL DEFAULT 0,
  upgrade_lines  int NOT NULL DEFAULT 0,
  -- Totals
  monthly_total    numeric(10,2) NOT NULL DEFAULT 0,
  activation_fee   numeric(10,2) NOT NULL DEFAULT 0,
  -- Status
  status  text NOT NULL DEFAULT 'draft', -- draft | sent | accepted | declined
  notes   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_lines (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id      uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_number   int  NOT NULL,
  plan_type     text NOT NULL, -- premium | extra | starter
  rate_plan     numeric(10,2) NOT NULL DEFAULT 0,
  plan_promo    numeric(10,2) NOT NULL DEFAULT 0,
  next_up       boolean NOT NULL DEFAULT false,
  next_up_amt   numeric(10,2) NOT NULL DEFAULT 6,
  insurance     numeric(10,2) NOT NULL DEFAULT 0,
  retailer_promo numeric(10,2) NOT NULL DEFAULT 0,
  device        numeric(10,2) NOT NULL DEFAULT 0,
  device_promo  numeric(10,2) NOT NULL DEFAULT 0,
  line_total    numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

-- Reps see their own quotes; managers see all in their org
CREATE POLICY "quotes: read"  ON quotes FOR SELECT
  USING (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "quotes: insert" ON quotes FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "quotes: update" ON quotes FOR UPDATE
  USING (
    rep_id = auth.uid() OR
    org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin','sales_manager','team_lead'))
  );

CREATE POLICY "quotes: delete" ON quotes FOR DELETE
  USING (
    rep_id = auth.uid() OR
    org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin','sales_manager'))
  );

CREATE POLICY "quote_lines: read"   ON quote_lines FOR SELECT USING (
  quote_id IN (SELECT id FROM quotes WHERE org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "quote_lines: write"  ON quote_lines FOR ALL USING (
  quote_id IN (SELECT id FROM quotes WHERE org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid()))
);

CREATE INDEX quotes_org_idx ON quotes(org_id, created_at DESC);
CREATE INDEX quotes_rep_idx ON quotes(rep_id, created_at DESC);
CREATE INDEX quote_lines_quote_idx ON quote_lines(quote_id, line_number);
