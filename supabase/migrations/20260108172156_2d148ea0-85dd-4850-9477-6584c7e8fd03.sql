-- Add vendor_type column to vendors table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'vendor_type') THEN
    ALTER TABLE public.vendors ADD COLUMN vendor_type text NOT NULL DEFAULT 'distributor';
  END IF;
END $$;

-- Add new columns to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS asset_number text,
ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS oem_id uuid REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);