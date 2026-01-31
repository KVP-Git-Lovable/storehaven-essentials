-- Budget Master Groups (like NSO checklist sections)
CREATE TABLE public.budget_master_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  store_type TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget Master Line Items (within groups)
CREATE TABLE public.budget_master_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.budget_master_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'expense', -- expense, rental, utility, staff, inventory, incidental
  default_amount NUMERIC(12,2) DEFAULT 0,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  is_recurring BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store Budgets (annual/monthly budget header)
CREATE TABLE public.store_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  budget_month INTEGER, -- NULL for annual, 1-12 for monthly
  budget_type TEXT NOT NULL DEFAULT 'annual', -- annual, monthly
  total_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, rejected
  submitted_by UUID,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, fiscal_year, budget_month)
);

-- Store Budget Line Items
CREATE TABLE public.store_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.store_budgets(id) ON DELETE CASCADE,
  master_item_id UUID REFERENCES public.budget_master_items(id),
  group_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'expense',
  description TEXT,
  budgeted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(12,2) DEFAULT 0,
  variance NUMERIC(12,2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
  ai_predicted_amount NUMERIC(12,2),
  is_custom BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Budget Approval History
CREATE TABLE public.budget_approval_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.store_budgets(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- submitted, approved, rejected, revised
  performed_by UUID,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_master_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_master_groups
CREATE POLICY "Allow read access to budget_master_groups" ON public.budget_master_groups FOR SELECT USING (true);
CREATE POLICY "Allow all access to budget_master_groups for authenticated" ON public.budget_master_groups FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for budget_master_items
CREATE POLICY "Allow read access to budget_master_items" ON public.budget_master_items FOR SELECT USING (true);
CREATE POLICY "Allow all access to budget_master_items for authenticated" ON public.budget_master_items FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for store_budgets
CREATE POLICY "Allow read access to store_budgets" ON public.store_budgets FOR SELECT USING (true);
CREATE POLICY "Allow all access to store_budgets for authenticated" ON public.store_budgets FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for store_budget_items
CREATE POLICY "Allow read access to store_budget_items" ON public.store_budget_items FOR SELECT USING (true);
CREATE POLICY "Allow all access to store_budget_items for authenticated" ON public.store_budget_items FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for budget_approval_history
CREATE POLICY "Allow read access to budget_approval_history" ON public.budget_approval_history FOR SELECT USING (true);
CREATE POLICY "Allow all access to budget_approval_history for authenticated" ON public.budget_approval_history FOR ALL USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_budget_master_items_group ON public.budget_master_items(group_id);
CREATE INDEX idx_store_budgets_store ON public.store_budgets(store_id);
CREATE INDEX idx_store_budgets_fiscal_year ON public.store_budgets(fiscal_year);
CREATE INDEX idx_store_budget_items_budget ON public.store_budget_items(budget_id);
CREATE INDEX idx_budget_approval_history_budget ON public.budget_approval_history(budget_id);

-- Trigger for updated_at
CREATE TRIGGER update_budget_master_groups_updated_at BEFORE UPDATE ON public.budget_master_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_budgets_updated_at BEFORE UPDATE ON public.store_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_budget_items_updated_at BEFORE UPDATE ON public.store_budget_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();