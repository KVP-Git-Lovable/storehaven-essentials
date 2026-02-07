
-- Add vendor_id to nso_master_assets
ALTER TABLE public.nso_master_assets 
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Add vendor_id to nso_store_assets
ALTER TABLE public.nso_store_assets 
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Add vendor_id to nso_master_budget_items
ALTER TABLE public.nso_master_budget_items 
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Add vendor_id to nso_store_budget_items
ALTER TABLE public.nso_store_budget_items 
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
