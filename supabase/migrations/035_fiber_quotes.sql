-- Add fiber quote support to the quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_type      text    NOT NULL DEFAULT 'wireless';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fiber_plan      text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS wireless_bundle boolean NOT NULL DEFAULT false;
