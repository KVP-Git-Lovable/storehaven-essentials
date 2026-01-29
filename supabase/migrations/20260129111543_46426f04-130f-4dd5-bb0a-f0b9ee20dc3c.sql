-- Add penalty clause fields to service_contracts table
ALTER TABLE public.service_contracts
ADD COLUMN IF NOT EXISTS penalty_applicable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS penalty_type text,
ADD COLUMN IF NOT EXISTS penalty_rate_percent numeric,
ADD COLUMN IF NOT EXISTS penalty_max_percent numeric,
ADD COLUMN IF NOT EXISTS penalty_grace_period_days integer,
ADD COLUMN IF NOT EXISTS penalty_calculation_basis text,
ADD COLUMN IF NOT EXISTS penalty_notes text,

-- Add coverage-specific fields
ADD COLUMN IF NOT EXISTS labour_rate_per_hour numeric,
ADD COLUMN IF NOT EXISTS labour_hours_included integer,
ADD COLUMN IF NOT EXISTS travel_rate_per_km numeric,
ADD COLUMN IF NOT EXISTS spares_coverage_percent numeric,
ADD COLUMN IF NOT EXISTS spares_max_value numeric,
ADD COLUMN IF NOT EXISTS spares_excluded_items text;