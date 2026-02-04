-- Add sq ft range columns to sqft_budget_master
ALTER TABLE public.sqft_budget_master 
ADD COLUMN min_sqft numeric DEFAULT 0,
ADD COLUMN max_sqft numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.sqft_budget_master.min_sqft IS 'Minimum sq ft for this rate (inclusive)';
COMMENT ON COLUMN public.sqft_budget_master.max_sqft IS 'Maximum sq ft for this rate (inclusive, NULL means unlimited)';