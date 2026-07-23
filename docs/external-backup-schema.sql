-- Run this in the external backup Supabase project
-- (ylvhhlykyojudldcmzou) via the SQL editor.
--
-- These trayi_* tables mirror rows from the main project. Primary keys match
-- so upserts (Prefer: resolution=merge-duplicates) are idempotent. The script
-- is safe to re-run: it creates missing tables and adds missing columns.

create table if not exists public.trayi_customers (
  id uuid primary key,
  customer_code text,
  phone text,
  name text,
  email text,
  date_of_birth date,
  anniversary_date date,
  gender text,
  city text,
  state text,
  country text,
  tier text,
  customer_segment text,
  loyalty_points integer,
  store_credit numeric,
  total_orders integer,
  total_spent numeric,
  preferences jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.trayi_orders (
  id uuid primary key,
  order_number text,
  store_id uuid,
  customer_id uuid,
  subtotal numeric,
  discount_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  payment_method text,
  payment_status text,
  payment_reference text,
  status text,
  order_type text,
  invoice_number text,
  invoice_generated_at timestamptz,
  coupon_id uuid,
  coupon_discount numeric,
  scheme_ids uuid[],
  loyalty_points_earned integer,
  loyalty_points_redeemed integer,
  gift_card_id uuid,
  gift_card_amount numeric,
  notes text,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.trayi_order_items (
  id uuid primary key,
  order_id uuid,
  item_id uuid,
  quantity integer,
  unit_price numeric,
  discount_percent numeric,
  discount_amount numeric,
  tax_percent numeric,
  tax_amount numeric,
  dia_price numeric,
  cs_price numeric,
  making_charges numeric,
  total_amount numeric,
  created_at timestamptz
);

create table if not exists public.trayi_inventory_items (
  id uuid primary key,
  name text,
  sku text,
  barcode text,
  category text,
  unit text,
  unit_cost numeric,
  selling_price numeric,
  min_stock integer,
  max_stock integer,
  expiry_tracking boolean,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  asset_master_id uuid,
  vendor_id uuid,
  rate_validity_date date,
  rate_validity_days integer,
  brand text,
  model text,
  warranty text,
  tax_rate numeric,
  image_url text,
  is_favorite boolean,
  cost_price numeric,
  style_no text,
  main_metal text,
  product_size text,
  colour text,
  gross_wt numeric,
  net_wt numeric,
  total_diamond_wt numeric,
  total_colour_stone_wt numeric,
  material_type text,
  material_quality text,
  material_inter_quality text,
  product_cert_no text,
  product_cert_by text,
  rm_cert_by text,
  rm_cert_no text,
  length numeric,
  material_weight numeric,
  material_pcs integer,
  item_price numeric,
  p_amount numeric,
  category_group text,
  material_rate numeric,
  tax_master_id uuid
);

create table if not exists public.trayi_profiles (
  id uuid primary key,
  username text,
  email text,
  role_id uuid,
  reports_to uuid,
  status text,
  must_reset_password boolean,
  profile_photo_url text,
  face_baseline_url text,
  theme_preference text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.trayi_user_roles_master (
  id uuid primary key,
  name text,
  description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Catch-up columns for projects where the original un-prefixed tables were
-- renamed to trayi_* before all current source columns existed.
alter table public.trayi_customers add column if not exists customer_code text;
alter table public.trayi_customers add column if not exists phone text;
alter table public.trayi_customers add column if not exists name text;
alter table public.trayi_customers add column if not exists email text;
alter table public.trayi_customers add column if not exists date_of_birth date;
alter table public.trayi_customers add column if not exists anniversary_date date;
alter table public.trayi_customers add column if not exists gender text;
alter table public.trayi_customers add column if not exists city text;
alter table public.trayi_customers add column if not exists state text;
alter table public.trayi_customers add column if not exists country text;
alter table public.trayi_customers add column if not exists tier text;
alter table public.trayi_customers add column if not exists customer_segment text;
alter table public.trayi_customers add column if not exists loyalty_points integer;
alter table public.trayi_customers add column if not exists store_credit numeric;
alter table public.trayi_customers add column if not exists total_orders integer;
alter table public.trayi_customers add column if not exists total_spent numeric;
alter table public.trayi_customers add column if not exists preferences jsonb;
alter table public.trayi_customers add column if not exists created_at timestamptz;
alter table public.trayi_customers add column if not exists updated_at timestamptz;

alter table public.trayi_orders add column if not exists order_number text;
alter table public.trayi_orders add column if not exists store_id uuid;
alter table public.trayi_orders add column if not exists customer_id uuid;
alter table public.trayi_orders add column if not exists subtotal numeric;
alter table public.trayi_orders add column if not exists discount_amount numeric;
alter table public.trayi_orders add column if not exists tax_amount numeric;
alter table public.trayi_orders add column if not exists total_amount numeric;
alter table public.trayi_orders add column if not exists payment_method text;
alter table public.trayi_orders add column if not exists payment_status text;
alter table public.trayi_orders add column if not exists payment_reference text;
alter table public.trayi_orders add column if not exists status text;
alter table public.trayi_orders add column if not exists order_type text;
alter table public.trayi_orders add column if not exists invoice_number text;
alter table public.trayi_orders add column if not exists invoice_generated_at timestamptz;
alter table public.trayi_orders add column if not exists coupon_id uuid;
alter table public.trayi_orders add column if not exists coupon_discount numeric;
alter table public.trayi_orders add column if not exists scheme_ids uuid[];
alter table public.trayi_orders add column if not exists loyalty_points_earned integer;
alter table public.trayi_orders add column if not exists loyalty_points_redeemed integer;
alter table public.trayi_orders add column if not exists gift_card_id uuid;
alter table public.trayi_orders add column if not exists gift_card_amount numeric;
alter table public.trayi_orders add column if not exists notes text;
alter table public.trayi_orders add column if not exists created_by text;
alter table public.trayi_orders add column if not exists created_at timestamptz;
alter table public.trayi_orders add column if not exists updated_at timestamptz;

alter table public.trayi_order_items add column if not exists order_id uuid;
alter table public.trayi_order_items add column if not exists item_id uuid;
alter table public.trayi_order_items add column if not exists quantity integer;
alter table public.trayi_order_items add column if not exists unit_price numeric;
alter table public.trayi_order_items add column if not exists discount_percent numeric;
alter table public.trayi_order_items add column if not exists discount_amount numeric;
alter table public.trayi_order_items add column if not exists tax_percent numeric;
alter table public.trayi_order_items add column if not exists tax_amount numeric;
alter table public.trayi_order_items add column if not exists dia_price numeric;
alter table public.trayi_order_items add column if not exists cs_price numeric;
alter table public.trayi_order_items add column if not exists making_charges numeric;
alter table public.trayi_order_items add column if not exists total_amount numeric;
alter table public.trayi_order_items add column if not exists created_at timestamptz;

alter table public.trayi_inventory_items add column if not exists name text;
alter table public.trayi_inventory_items add column if not exists sku text;
alter table public.trayi_inventory_items add column if not exists barcode text;
alter table public.trayi_inventory_items add column if not exists category text;
alter table public.trayi_inventory_items add column if not exists unit text;
alter table public.trayi_inventory_items add column if not exists unit_cost numeric;
alter table public.trayi_inventory_items add column if not exists selling_price numeric;
alter table public.trayi_inventory_items add column if not exists min_stock integer;
alter table public.trayi_inventory_items add column if not exists max_stock integer;
alter table public.trayi_inventory_items add column if not exists expiry_tracking boolean;
alter table public.trayi_inventory_items add column if not exists status text;
alter table public.trayi_inventory_items add column if not exists created_at timestamptz;
alter table public.trayi_inventory_items add column if not exists updated_at timestamptz;
alter table public.trayi_inventory_items add column if not exists asset_master_id uuid;
alter table public.trayi_inventory_items add column if not exists vendor_id uuid;
alter table public.trayi_inventory_items add column if not exists rate_validity_date date;
alter table public.trayi_inventory_items add column if not exists rate_validity_days integer;
alter table public.trayi_inventory_items add column if not exists brand text;
alter table public.trayi_inventory_items add column if not exists model text;
alter table public.trayi_inventory_items add column if not exists warranty text;
alter table public.trayi_inventory_items add column if not exists tax_rate numeric;
alter table public.trayi_inventory_items add column if not exists image_url text;
alter table public.trayi_inventory_items add column if not exists is_favorite boolean;
alter table public.trayi_inventory_items add column if not exists cost_price numeric;
alter table public.trayi_inventory_items add column if not exists style_no text;
alter table public.trayi_inventory_items add column if not exists main_metal text;
alter table public.trayi_inventory_items add column if not exists product_size text;
alter table public.trayi_inventory_items add column if not exists colour text;
alter table public.trayi_inventory_items add column if not exists gross_wt numeric;
alter table public.trayi_inventory_items add column if not exists net_wt numeric;
alter table public.trayi_inventory_items add column if not exists total_diamond_wt numeric;
alter table public.trayi_inventory_items add column if not exists total_colour_stone_wt numeric;
alter table public.trayi_inventory_items add column if not exists material_type text;
alter table public.trayi_inventory_items add column if not exists material_quality text;
alter table public.trayi_inventory_items add column if not exists material_inter_quality text;
alter table public.trayi_inventory_items add column if not exists product_cert_no text;
alter table public.trayi_inventory_items add column if not exists product_cert_by text;
alter table public.trayi_inventory_items add column if not exists rm_cert_by text;
alter table public.trayi_inventory_items add column if not exists rm_cert_no text;
alter table public.trayi_inventory_items add column if not exists length numeric;
alter table public.trayi_inventory_items add column if not exists material_weight numeric;
alter table public.trayi_inventory_items add column if not exists material_pcs integer;
alter table public.trayi_inventory_items add column if not exists item_price numeric;
alter table public.trayi_inventory_items add column if not exists p_amount numeric;
alter table public.trayi_inventory_items add column if not exists category_group text;
alter table public.trayi_inventory_items add column if not exists material_rate numeric;
alter table public.trayi_inventory_items add column if not exists tax_master_id uuid;

alter table public.trayi_profiles add column if not exists username text;
alter table public.trayi_profiles add column if not exists email text;
alter table public.trayi_profiles add column if not exists role_id uuid;
alter table public.trayi_profiles add column if not exists reports_to uuid;
alter table public.trayi_profiles add column if not exists status text;
alter table public.trayi_profiles add column if not exists must_reset_password boolean;
alter table public.trayi_profiles add column if not exists profile_photo_url text;
alter table public.trayi_profiles add column if not exists face_baseline_url text;
alter table public.trayi_profiles add column if not exists theme_preference text;
alter table public.trayi_profiles add column if not exists created_at timestamptz;
alter table public.trayi_profiles add column if not exists updated_at timestamptz;

alter table public.trayi_user_roles_master add column if not exists name text;
alter table public.trayi_user_roles_master add column if not exists description text;
alter table public.trayi_user_roles_master add column if not exists status text;
alter table public.trayi_user_roles_master add column if not exists created_at timestamptz;
alter table public.trayi_user_roles_master add column if not exists updated_at timestamptz;

-- Required for PostgREST/Data API writes with the service-role JWT.
grant all on public.trayi_customers to service_role;
grant all on public.trayi_orders to service_role;
grant all on public.trayi_order_items to service_role;
grant all on public.trayi_inventory_items to service_role;
grant all on public.trayi_profiles to service_role;
grant all on public.trayi_user_roles_master to service_role;

-- Keep anon/authenticated locked out; the backup key uses service_role.
revoke all on public.trayi_customers from anon, authenticated;
revoke all on public.trayi_orders from anon, authenticated;
revoke all on public.trayi_order_items from anon, authenticated;
revoke all on public.trayi_inventory_items from anon, authenticated;
revoke all on public.trayi_profiles from anon, authenticated;
revoke all on public.trayi_user_roles_master from anon, authenticated;

alter table public.trayi_customers         enable row level security;
alter table public.trayi_orders            enable row level security;
alter table public.trayi_order_items       enable row level security;
alter table public.trayi_inventory_items   enable row level security;
alter table public.trayi_profiles          enable row level security;
alter table public.trayi_user_roles_master enable row level security;