-- Create table for required assets in NSO checklist masters
CREATE TABLE public.nso_master_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_id UUID NOT NULL REFERENCES public.nso_checklist_masters(id) ON DELETE CASCADE,
  asset_master_id UUID NOT NULL REFERENCES public.asset_masters(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(master_id, asset_master_id)
);

-- Enable RLS
ALTER TABLE public.nso_master_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access" ON public.nso_master_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_master_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_master_assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_master_assets FOR DELETE USING (true);

-- Create table for required assets in store-specific checklists
CREATE TABLE public.nso_store_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.nso_store_checklists(id) ON DELETE CASCADE,
  asset_master_id UUID NOT NULL REFERENCES public.asset_masters(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(checklist_id, asset_master_id)
);

-- Enable RLS
ALTER TABLE public.nso_store_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access" ON public.nso_store_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_store_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_store_assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_store_assets FOR DELETE USING (true);