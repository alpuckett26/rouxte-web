-- Add quiz_variants column to store 3 pre-generated quiz variants per module.
-- quiz_variants: JSONB array of 3 question sets
--   [ [{question, options[], correct, explanation}, ...], [...], [...] ]
-- The serving layer picks a random index at request time so reps never see
-- the same quiz twice in a row. New quizzes are only generated when modules
-- are added, not on every attempt.

ALTER TABLE training_quizzes
  ADD COLUMN IF NOT EXISTS quiz_variants JSONB;
