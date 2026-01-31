-- Store Targets Module: Database Schema

-- 1. Store Targets - Annual targets per store
CREATE TABLE public.store_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL, -- e.g., 2025, 2026
  annual_target NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived'
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, fiscal_year)
);

-- 2. Store Target Monthly Breakdown
CREATE TABLE public.store_target_months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_target_id UUID NOT NULL REFERENCES public.store_targets(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  target_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_target_id, month)
);

-- 3. Store Target Member Allocation
CREATE TABLE public.store_target_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_target_id UUID NOT NULL REFERENCES public.store_targets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month INTEGER CHECK (month >= 1 AND month <= 12), -- NULL means annual
  target_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Store Target Product Allocation
CREATE TABLE public.store_target_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_target_id UUID NOT NULL REFERENCES public.store_targets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month INTEGER CHECK (month >= 1 AND month <= 12), -- NULL means annual
  target_quantity INTEGER NOT NULL DEFAULT 0,
  target_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.store_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_target_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_target_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_target_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_targets
CREATE POLICY "Authenticated users can view store targets" 
  ON public.store_targets FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create store targets" 
  ON public.store_targets FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update store targets" 
  ON public.store_targets FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete store targets" 
  ON public.store_targets FOR DELETE 
  USING (auth.role() = 'authenticated');

-- RLS Policies for store_target_months
CREATE POLICY "Authenticated users can view store target months" 
  ON public.store_target_months FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage store target months" 
  ON public.store_target_months FOR ALL 
  USING (auth.role() = 'authenticated');

-- RLS Policies for store_target_members
CREATE POLICY "Authenticated users can view store target members" 
  ON public.store_target_members FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage store target members" 
  ON public.store_target_members FOR ALL 
  USING (auth.role() = 'authenticated');

-- RLS Policies for store_target_products
CREATE POLICY "Authenticated users can view store target products" 
  ON public.store_target_products FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage store target products" 
  ON public.store_target_products FOR ALL 
  USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX idx_store_targets_store_id ON public.store_targets(store_id);
CREATE INDEX idx_store_targets_fiscal_year ON public.store_targets(fiscal_year);
CREATE INDEX idx_store_target_months_target_id ON public.store_target_months(store_target_id);
CREATE INDEX idx_store_target_members_target_id ON public.store_target_members(store_target_id);
CREATE INDEX idx_store_target_members_employee_id ON public.store_target_members(employee_id);
CREATE INDEX idx_store_target_products_target_id ON public.store_target_products(store_target_id);
CREATE INDEX idx_store_target_products_product_id ON public.store_target_products(product_id);

-- Triggers for updated_at
CREATE TRIGGER update_store_targets_updated_at
  BEFORE UPDATE ON public.store_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_target_months_updated_at
  BEFORE UPDATE ON public.store_target_months
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_target_members_updated_at
  BEFORE UPDATE ON public.store_target_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_target_products_updated_at
  BEFORE UPDATE ON public.store_target_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();