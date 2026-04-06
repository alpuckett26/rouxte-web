-- Competitor pricing and intel (org_id null = global defaults visible to all)
create table competitor_intel (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid references orgs(id) on delete cascade,
  competitor       text not null,
  plan_name        text not null,
  monthly_price    numeric(8,2),
  download_mbps    int,
  upload_mbps      int,
  contract_required boolean not null default false,
  data_cap_gb      int,        -- null = unlimited
  notes            text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Manager-curated objection/response Q&A pairs
create table coach_qa (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references orgs(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  trigger     text not null,   -- the objection or situation
  response    text not null,   -- the proven response
  category    text not null default 'objection', -- objection | pitch | closing | product
  use_count   int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table competitor_intel enable row level security;
alter table coach_qa enable row level security;

create policy "competitor_intel_read" on competitor_intel for select using (
  org_id is null or org_id = my_org_id()
);
create policy "competitor_intel_manage" on competitor_intel for all using (
  org_id = my_org_id() and my_role() in ('admin','sales_manager')
);
create policy "coach_qa_read" on coach_qa for select using (org_id = my_org_id());
create policy "coach_qa_manage" on coach_qa for all using (
  org_id = my_org_id() and my_role() in ('admin','sales_manager','team_lead')
);

-- ── Seed global competitor data ────────────────────────────────────────────
insert into competitor_intel (competitor, plan_name, monthly_price, download_mbps, upload_mbps, contract_required, data_cap_gb, notes) values
-- Spectrum
('Spectrum', 'Internet (300 Mbps)', 50.00, 300, 10, false, null, 'Promo rate for 12 months, then increases $25+. Asymmetric — upload is very slow. No data cap.'),
('Spectrum', 'Internet Ultra (500 Mbps)', 70.00, 500, 20, false, null, 'Still asymmetric upload. No data cap. Price goes up after promo.'),
('Spectrum', 'Internet Gig (1 Gbps)', 90.00, 1000, 35, false, null, 'Cable-based, upload still capped at 35 Mbps. No data cap.'),
-- Xfinity / Comcast
('Xfinity', 'Connect (75 Mbps)', 35.00, 75, 15, false, 1229, 'Very slow. 1.2TB data cap — overage charges after.'),
('Xfinity', 'Fast (400 Mbps)', 55.00, 400, 20, false, 1229, '1.2TB data cap with overage fees. Upload is slow.'),
('Xfinity', 'Gigabit (1 Gbps)', 80.00, 1000, 35, false, 1229, 'Cable — upload stays at 35 Mbps. Still has data cap.'),
-- Cox
('Cox', 'Essential (100 Mbps)', 50.00, 100, 10, false, 1280, 'Slow speeds, 1.25TB data cap, prices increase after first year.'),
('Cox', 'Preferred (500 Mbps)', 70.00, 500, 20, false, 1280, '1.25TB data cap with $10/50GB overage. Asymmetric upload.'),
('Cox', 'Gigablast (1 Gbps)', 100.00, 1000, 35, false, 1280, 'Cable-based, low upload, data cap still applies.'),
-- T-Mobile Home Internet
('T-Mobile Home Internet', '5G Home Internet', 50.00, 245, 65, false, null, 'Average 245 Mbps but highly variable — can drop to 50 Mbps during peak hours. Wireless, so no guaranteed speed. No data cap. $50 with T-Mobile phone plan, $60 standalone.'),
-- Verizon
('Verizon', 'LTE Home Internet', 25.00, 25, 25, false, null, 'Very slow LTE-based. $25/mo with phone plan. Not fiber.'),
('Verizon', '5G Home Internet', 50.00, 300, 50, false, null, 'Variable speeds, not available everywhere. No data cap. Requires 5G coverage.'),
-- AT&T Fiber (our product — for comparison reference)
('AT&T Fiber', '300 Mbps', 55.00, 300, 300, false, null, 'Symmetrical upload AND download. No data cap. No contracts. Price locked with autopay.'),
('AT&T Fiber', '500 Mbps', 65.00, 500, 500, false, null, 'Symmetrical. No data cap. No contract. Includes BGW320 gateway.'),
('AT&T Fiber', '1 Gig', 85.00, 1000, 1000, false, null, 'Symmetrical gigabit. No data cap. No contract. Best value at this tier.'),
('AT&T Fiber', '2 Gig', 110.00, 2000, 2000, false, null, 'Symmetrical 2Gbps. No data cap. No contract. Requires 2.5GbE router.'),
('AT&T Fiber', '5 Gig', 250.00, 5000, 5000, false, null, 'Symmetrical 5Gbps. No data cap. No contract. Multi-gig capable equipment required.');
