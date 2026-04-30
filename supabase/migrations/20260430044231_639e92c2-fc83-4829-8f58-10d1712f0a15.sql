-- Add customer_code (unique, alphanumeric, will be enforced as required for new rows after backfill) and address fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text;

-- Backfill customer_code for existing rows that don't have one yet
UPDATE public.customers
SET customer_code = 'CUST-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
WHERE customer_code IS NULL OR customer_code = '';

-- Enforce NOT NULL and uniqueness for customer_code
ALTER TABLE public.customers
  ALTER COLUMN customer_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_unique
  ON public.customers (customer_code);

-- Allow only alphanumeric, dashes and underscores for customer_code
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_customer_code_format_chk;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_code_format_chk
  CHECK (customer_code ~ '^[A-Za-z0-9_-]+$');