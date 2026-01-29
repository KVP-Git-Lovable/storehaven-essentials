-- Make source_warehouse_id nullable since we're removing it from the form
ALTER TABLE public.requisitions ALTER COLUMN source_warehouse_id DROP NOT NULL;