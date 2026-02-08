
-- Add target_store_identification_date to store_plans
ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS target_store_identification_date DATE;

-- Add store_identified and franchisee_identified boolean flags
ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS store_identified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.store_plans ADD COLUMN IF NOT EXISTS franchisee_identified BOOLEAN NOT NULL DEFAULT false;

-- Add alignment field to franchisees
ALTER TABLE public.franchisees ADD COLUMN IF NOT EXISTS alignment TEXT DEFAULT 'average';
