-- Add 'documents' step to onboarding enum (between profile and complete)
ALTER TYPE onboarding_step ADD VALUE IF NOT EXISTS 'documents' BEFORE 'complete';

-- ─── Onboarding Document Templates ───────────────────────────────────────────
-- Defines which forms are required for an org's new hires.
-- Seeded with defaults on first access; org admins can toggle required flag.

CREATE TABLE IF NOT EXISTS onboarding_document_templates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('w4','i9','w9','direct_deposit','background_check','company_policy')),
  title         text NOT NULL,
  required      boolean NOT NULL DEFAULT true,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, doc_type)
);

ALTER TABLE onboarding_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_templates: org read" ON onboarding_document_templates
  FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1));

GRANT SELECT ON onboarding_document_templates TO authenticated;

-- ─── Onboarding Document Submissions ─────────────────────────────────────────
-- Stores a signed copy of each completed form.

CREATE TABLE IF NOT EXISTS onboarding_document_submissions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id   uuid NOT NULL REFERENCES onboarding_document_templates(id) ON DELETE CASCADE,
  doc_type      text NOT NULL,
  form_data     jsonb NOT NULL DEFAULT '{}',
  signed_name   text NOT NULL,
  signed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, template_id)
);

CREATE INDEX IF NOT EXISTS doc_subs_user_idx ON onboarding_document_submissions(user_id);
CREATE INDEX IF NOT EXISTS doc_subs_org_idx  ON onboarding_document_submissions(org_id);

ALTER TABLE onboarding_document_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read and insert their own submissions
CREATE POLICY "doc_subs: own read" ON onboarding_document_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "doc_subs: own insert" ON onboarding_document_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Managers/team leads can read all submissions in their org
CREATE POLICY "doc_subs: org manager read" ON onboarding_document_submissions
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1) IN ('admin','sales_manager','team_lead')
  );

GRANT SELECT, INSERT ON onboarding_document_submissions TO authenticated;
