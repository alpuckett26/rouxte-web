-- Migration 024: Pre-compiled training quizzes
-- Quizzes are generated once by AI (admin action) and stored here.
-- The quiz route serves questions with correct answers HIDDEN from the client.
-- Grading happens server-side only.

CREATE TABLE IF NOT EXISTS training_quizzes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL UNIQUE REFERENCES training_documents(id) ON DELETE CASCADE,
  org_id       uuid        REFERENCES orgs(id),
  questions    jsonb       NOT NULL, -- array of { question, options, correct, explanation }
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid        REFERENCES auth.users(id)
);

-- Only managers/admins can write; anyone in the org can read question text (not answers)
ALTER TABLE training_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read quizzes"
  ON training_quizzes FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid())
    OR org_id IS NULL
  );

CREATE POLICY "managers can upsert quizzes"
  ON training_quizzes FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'sales_manager')
    )
  );
