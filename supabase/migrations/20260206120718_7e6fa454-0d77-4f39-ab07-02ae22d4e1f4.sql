
-- Add new fields for Furniture/Fixtures templates
ALTER TABLE public.asset_masters ADD COLUMN material TEXT;
ALTER TABLE public.asset_masters ADD COLUMN finish_color TEXT;
ALTER TABLE public.asset_masters ADD COLUMN load_capacity TEXT;
