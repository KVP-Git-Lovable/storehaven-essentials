-- Add new fields to asset_masters table for default values
ALTER TABLE public.asset_masters
ADD COLUMN IF NOT EXISTS default_vendor_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS default_oem_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS default_asset_status TEXT DEFAULT 'working',
ADD COLUMN IF NOT EXISTS default_service_engagement TEXT DEFAULT 'under_warranty',
ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

-- Add comments for clarity
COMMENT ON COLUMN public.asset_masters.default_vendor_id IS 'Default vendor for assets created from this master';
COMMENT ON COLUMN public.asset_masters.default_oem_id IS 'Default OEM for assets created from this master';
COMMENT ON COLUMN public.asset_masters.default_asset_status IS 'Default status for assets created from this master';
COMMENT ON COLUMN public.asset_masters.default_service_engagement IS 'Default service engagement for assets created from this master';