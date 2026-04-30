-- Add product-equivalent columns to inventory_items (all nullable for backward compat)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS tax_rate numeric,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_price numeric;

-- Helper: derive current stock for an inventory item from stock_ledger
CREATE OR REPLACE FUNCTION public.get_inventory_stock(_item_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(quantity_change), 0)::integer
  FROM public.stock_ledger
  WHERE item_id = _item_id;
$$;

-- Bulk variant for batched lookups (returns rows of item_id, stock)
CREATE OR REPLACE FUNCTION public.get_inventory_stock_map(_item_ids uuid[])
RETURNS TABLE(item_id uuid, stock integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sl.item_id, COALESCE(SUM(sl.quantity_change), 0)::integer AS stock
  FROM public.stock_ledger sl
  WHERE sl.item_id = ANY(_item_ids)
  GROUP BY sl.item_id;
$$;

-- Migrate any existing products data into inventory_items, preserving IDs
INSERT INTO public.inventory_items (
  id, name, sku, barcode, category, unit, unit_cost, selling_price,
  min_stock, status, brand, model, warranty, tax_rate, image_url,
  is_favorite, cost_price, created_at
)
SELECT
  p.id,
  p.name,
  p.sku,
  p.barcode,
  COALESCE(NULLIF(p.category, ''), 'General'),
  'pcs',
  COALESCE(p.cost_price, 0),
  COALESCE(p.price, 0),
  COALESCE(p.min_stock, 0),
  'active',
  p.brand,
  p.model,
  p.warranty,
  p.tax_rate,
  p.image_url,
  COALESCE(p.is_favorite, false),
  p.cost_price,
  p.created_at
FROM public.products p
ON CONFLICT (id) DO NOTHING;

-- Seed opening-balance ledger entries for migrated products with stock
INSERT INTO public.stock_ledger (
  item_id, location_type, location_id, transaction_type,
  quantity_change, unit_cost, reference_type, notes, created_by
)
SELECT
  p.id,
  'global',
  NULL,
  'opening_balance',
  p.stock_qty,
  COALESCE(p.cost_price, 0),
  'migration',
  'Opening balance migrated from products table',
  'system'
FROM public.products p
WHERE COALESCE(p.stock_qty, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_ledger sl
    WHERE sl.item_id = p.id AND sl.transaction_type = 'opening_balance' AND sl.reference_type = 'migration'
  );