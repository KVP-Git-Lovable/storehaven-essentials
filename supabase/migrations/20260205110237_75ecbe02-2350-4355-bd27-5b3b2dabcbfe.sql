-- Add missing columns to nso_store_budget_items for full budget tracking
ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS planned_amount NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.nso_store_budget_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Migrate existing description data to name column
UPDATE public.nso_store_budget_items 
SET name = description, planned_amount = amount
WHERE name IS NULL;

-- Make name NOT NULL after migration
ALTER TABLE public.nso_store_budget_items 
ALTER COLUMN name SET NOT NULL;

-- Create trigger for updated_at if not exists
DROP TRIGGER IF EXISTS update_nso_store_budget_items_updated_at ON public.nso_store_budget_items;
CREATE TRIGGER update_nso_store_budget_items_updated_at
  BEFORE UPDATE ON public.nso_store_budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();