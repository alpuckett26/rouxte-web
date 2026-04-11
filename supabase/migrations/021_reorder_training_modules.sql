-- Reorder training modules: rules & regulations first
-- This uses keyword matching on title. Adjust the ILIKE patterns to match
-- your exact module titles if needed.

UPDATE training_documents
SET sequence_order = CASE
  -- Rules, regulations, compliance, legal → top slots
  WHEN title ILIKE '%rule%'        OR title ILIKE '%regulation%'   THEN 10
  WHEN title ILIKE '%compliance%'  OR title ILIKE '%legal%'         THEN 20
  WHEN title ILIKE '%policy%'      OR title ILIKE '%policies%'      THEN 30
  WHEN title ILIKE '%code of conduct%' OR title ILIKE '%ethics%'    THEN 40

  -- Safety next
  WHEN title ILIKE '%safety%'      OR title ILIKE '%hazard%'        THEN 50

  -- Product / service knowledge
  WHEN title ILIKE '%product%'     OR title ILIKE '%service%'       THEN 100
  WHEN title ILIKE '%package%'     OR title ILIKE '%plan%'          THEN 110

  -- Sales process / techniques
  WHEN title ILIKE '%sales%'       OR title ILIKE '%pitch%'         THEN 200
  WHEN title ILIKE '%door%'        OR title ILIKE '%knock%'         THEN 210
  WHEN title ILIKE '%objection%'   OR title ILIKE '%close%'         THEN 220

  -- Tools / systems
  WHEN title ILIKE '%rouxte%'      OR title ILIKE '%app%'           THEN 300
  WHEN title ILIKE '%crm%'         OR title ILIKE '%lead%'          THEN 310

  -- Everything else retains relative order
  ELSE COALESCE(sequence_order, 999) + 500
END
WHERE folder = 'training';

-- Re-number to clean sequential integers (1, 2, 3…)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY sequence_order NULLS LAST, title) AS new_order
  FROM training_documents
  WHERE folder = 'training'
)
UPDATE training_documents d
SET sequence_order = r.new_order
FROM ranked r
WHERE d.id = r.id;

-- Preview result
SELECT sequence_order, title FROM training_documents
WHERE folder = 'training'
ORDER BY sequence_order;
