-- Add import-friendly columns to leads
alter table leads
  add column if not exists customer_name text,
  add column if not exists phone text,
  add column if not exists source text not null default 'manual';

-- Make lat/lng nullable so imported leads without coords still work
alter table leads alter column lat drop not null;
alter table leads alter column lng drop not null;
