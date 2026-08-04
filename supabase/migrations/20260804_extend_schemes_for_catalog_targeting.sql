-- Extend schemes table to support category and product-specific targeting
-- This migration adds fields for:
-- 1. Rule types (category, category+dia, category+making, category+price, product)
-- 2. Target specifications
-- 3. Discount basis configuration
-- 4. Priority for scheme selection

ALTER TABLE public.schemes
ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50) DEFAULT 'generic', -- 'generic', 'category', 'category_dia', 'category_making', 'category_price', 'product'
ADD COLUMN IF NOT EXISTS target_categories TEXT[] DEFAULT NULL, -- Array of product_type values
ADD COLUMN IF NOT EXISTS target_products UUID[] DEFAULT NULL, -- Array of catalog_product IDs
ADD COLUMN IF NOT EXISTS dia_charge_min NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dia_charge_max NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS making_charge_min NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS making_charge_max NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_min NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_max NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_basis VARCHAR(50) DEFAULT 'product_price', -- 'product_price', 'dia_charge', 'making_charge', 'total_eligible'
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_auto_apply BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS applicable_categories TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC DEFAULT NULL;

-- Add index for faster queries on status and dates
CREATE INDEX IF NOT EXISTS schemes_status_dates_idx ON public.schemes(status, start_date, end_date);

-- Add index for rule type
CREATE INDEX IF NOT EXISTS schemes_rule_type_idx ON public.schemes(rule_type);

-- Add index for priority
CREATE INDEX IF NOT EXISTS schemes_priority_idx ON public.schemes(priority DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.schemes.rule_type IS 'Type of scheme targeting: generic, category, category_dia, category_making, category_price, or product';
COMMENT ON COLUMN public.schemes.target_categories IS 'Array of product_type values this scheme targets';
COMMENT ON COLUMN public.schemes.target_products IS 'Array of catalog_product IDs this scheme targets';
COMMENT ON COLUMN public.schemes.discount_basis IS 'What amount the discount applies to: product_price, dia_charge, making_charge, or total_eligible';
COMMENT ON COLUMN public.schemes.priority IS 'Priority for scheme selection when multiple schemes apply (higher number = higher priority)';
