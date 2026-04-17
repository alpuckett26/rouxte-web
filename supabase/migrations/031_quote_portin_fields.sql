ALTER TABLE quote_lines
  ADD COLUMN IF NOT EXISTS portin_phone   text,
  ADD COLUMN IF NOT EXISTS portin_carrier text,
  ADD COLUMN IF NOT EXISTS portin_account text,
  ADD COLUMN IF NOT EXISTS portin_pin     text;
