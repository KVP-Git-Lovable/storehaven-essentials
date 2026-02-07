
-- Create master budget items table mirroring store budget items structure
CREATE TABLE public.nso_master_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_id UUID NOT NULL REFERENCES public.nso_checklist_masters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  planned_amount NUMERIC DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nso_master_budget_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other NSO tables)
CREATE POLICY "Allow all access to nso_master_budget_items"
  ON public.nso_master_budget_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
