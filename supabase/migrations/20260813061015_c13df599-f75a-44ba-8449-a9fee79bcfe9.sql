ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS interest text,
  ADD COLUMN IF NOT EXISTS preferred_date date,
  ADD COLUMN IF NOT EXISTS source text;