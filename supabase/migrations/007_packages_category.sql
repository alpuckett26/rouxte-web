-- Add category column to packages for grouping (internet new / migration / mobility / insurance)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'new'
    CHECK (category IN ('new', 'migration', 'mobility', 'insurance'));

-- AT&T-specific comp breakdown fields
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS base_comp     numeric(10,2),
  ADD COLUMN IF NOT EXISTS vir_incentive numeric(10,2) DEFAULT 0;

-- Chargeback liability window in days (90 standard, 180 for BYOD)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS chargeback_days integer NOT NULL DEFAULT 90;
