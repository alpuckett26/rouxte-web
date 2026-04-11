-- Rouxte Store: orders for physical products (badges, door hangers, gear, etc.)
create table if not exists store_orders (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references orgs(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,

  -- product
  product_type          text not null,          -- 'badge' | 'door_hanger' | 'business_card' | 'vehicle_magnet'
  quantity              integer not null default 1,
  unit_price_cents      integer not null,
  total_cents           integer not null,

  -- lifecycle
  status                text not null default 'pending',
  -- pending → paid → printing → shipped → delivered | cancelled | refunded

  -- payment
  stripe_session_id     text unique,
  stripe_payment_intent text,

  -- fulfillment
  fulfillment_provider  text default 'printful',
  fulfillment_order_id  text,
  tracking_url          text,

  -- recipient
  shipping_address      jsonb,                  -- {name, address1, address2, city, state, zip, country}

  -- product-specific config
  product_config        jsonb,
  -- badge: {full_name, title, org_name, org_logo_url, avatar_url, badge_number, qr_url}
  -- door_hanger: {headline, phone, website, color_scheme}

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists store_orders_org_id_idx    on store_orders(org_id);
create index if not exists store_orders_user_id_idx   on store_orders(user_id);
create index if not exists store_orders_status_idx    on store_orders(status);

-- RLS
alter table store_orders enable row level security;

-- Reps see only their own orders
create policy "rep_see_own_orders" on store_orders
  for select using (user_id = auth.uid());

-- Admins/managers see all org orders
create policy "manager_see_org_orders" on store_orders
  for select using (
    exists (
      select 1 from user_profiles p
      where p.user_id = auth.uid()
        and p.org_id  = store_orders.org_id
        and p.role in ('admin', 'sales_manager')
    )
  );

-- Anyone authenticated can insert their own orders (API validates)
create policy "user_insert_own_order" on store_orders
  for insert with check (user_id = auth.uid());

-- Only service role updates (via webhook / admin)
-- (service-role bypasses RLS, so no explicit update policy needed)

-- updated_at trigger
create or replace function touch_store_order()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists store_orders_updated_at on store_orders;
create trigger store_orders_updated_at
  before update on store_orders
  for each row execute procedure touch_store_order();
