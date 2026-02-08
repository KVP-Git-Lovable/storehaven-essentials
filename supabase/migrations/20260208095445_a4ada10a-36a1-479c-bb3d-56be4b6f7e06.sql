
-- Add store_plan_id to franchisees table
ALTER TABLE public.franchisees 
ADD COLUMN store_plan_id UUID REFERENCES public.store_plans(id) ON DELETE SET NULL;

-- Add store_plan_id to nso_store_checklists table  
ALTER TABLE public.nso_store_checklists
ADD COLUMN store_plan_id UUID REFERENCES public.store_plans(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_franchisees_store_plan_id ON public.franchisees(store_plan_id);
CREATE INDEX idx_nso_store_checklists_store_plan_id ON public.nso_store_checklists(store_plan_id);
