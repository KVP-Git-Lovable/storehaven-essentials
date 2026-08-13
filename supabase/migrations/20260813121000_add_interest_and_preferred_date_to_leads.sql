-- Add interest and preferred_date columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS interest text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS preferred_date date;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_leads_preferred_date ON public.leads(preferred_date);
