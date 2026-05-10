-- Add customer email (for emailing quotes) and rep-entered promo note to quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promo_note     text;
