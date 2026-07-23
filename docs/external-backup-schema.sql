-- Run this ONCE in the external backup Supabase project
-- (ylvhhlykyojudldcmzou) via the SQL editor.
--
-- These tables mirror rows from the main project. Primary keys match so
-- upserts (Prefer: resolution=merge-duplicates) are idempotent. No foreign
-- keys, no RLS policies — only the service role writes here.

create table if not exists public.customers (
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

create table if not exists public.orders (
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

create table if not exists public.order_items (
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

create table if not exists public.inventory_items (
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

create table if not exists public.profiles (
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

create table if not exists public.user_roles_master (
  id uuid primary key,
  name text,
  description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Lock down anon/authenticated access; only the service_role (used by the
-- mirror edge function) writes here.
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.profiles          enable row level security;
alter table public.user_roles_master enable row level security;