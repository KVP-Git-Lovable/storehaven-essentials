
-- Create asset_masters table
CREATE TABLE public.asset_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  criticality TEXT NOT NULL DEFAULT 'medium' CHECK (criticality IN ('high', 'medium', 'low')),
  investment_size TEXT NOT NULL DEFAULT 'medium' CHECK (investment_size IN ('high', 'medium', 'low')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset_master_vendors junction table
CREATE TABLE public.asset_master_vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_master_id UUID NOT NULL REFERENCES public.asset_masters(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category TEXT,
  vendor_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset_master_id, vendor_id)
);

-- Add asset_master_id and store_id to assets table
ALTER TABLE public.assets 
ADD COLUMN asset_master_id UUID REFERENCES public.asset_masters(id),
ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- Enable RLS
ALTER TABLE public.asset_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_master_vendors ENABLE ROW LEVEL SECURITY;

-- RLS policies for asset_masters
CREATE POLICY "Allow public read access" ON public.asset_masters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.asset_masters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.asset_masters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.asset_masters FOR DELETE USING (true);

-- RLS policies for asset_master_vendors
CREATE POLICY "Allow public read access" ON public.asset_master_vendors FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.asset_master_vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.asset_master_vendors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.asset_master_vendors FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_asset_masters_updated_at
BEFORE UPDATE ON public.asset_masters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
