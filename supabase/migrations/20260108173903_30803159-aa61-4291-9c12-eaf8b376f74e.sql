-- Add warranty dates to assets
ALTER TABLE public.assets 
ADD COLUMN warranty_start_date text,
ADD COLUMN warranty_end_date text;

-- Create junction table for service contracts and assets (many-to-many)
CREATE TABLE public.service_contract_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_contract_id, asset_id)
);

-- Enable RLS
ALTER TABLE public.service_contract_assets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" ON public.service_contract_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contract_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contract_assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contract_assets FOR DELETE USING (true);

-- Add asset_id to utility_readings
ALTER TABLE public.utility_readings 
ADD COLUMN asset_id UUID REFERENCES public.assets(id);