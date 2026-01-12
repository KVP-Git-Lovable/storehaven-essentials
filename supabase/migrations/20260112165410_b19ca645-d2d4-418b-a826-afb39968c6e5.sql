-- Create store_asset_deployments table to track asset deployment details at stores
CREATE TABLE public.store_asset_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  deployed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_service', 'broke_down', 'low_performance', 'needs_replacement', 'inactive', 'removed')),
  removed_date DATE,
  feedback TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, asset_id)
);

-- Create service_tickets table (replacing incidents concept for store/asset level)
CREATE TABLE public.service_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_parts', 'resolved', 'closed', 'cancelled')),
  reported_by VARCHAR(100) NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_to VARCHAR(100),
  sla_due_date TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  resolution_time_hours NUMERIC(10,2),
  solution_provided TEXT,
  resolved_by VARCHAR(100),
  manager_feedback TEXT,
  manager_confirmed BOOLEAN DEFAULT FALSE,
  manager_confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store_preventive_maintenance table for store-level PM calendar
CREATE TABLE public.store_preventive_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled')),
  assigned_to VARCHAR(100),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(100),
  manager_confirmed BOOLEAN DEFAULT FALSE,
  manager_confirmed_at TIMESTAMP WITH TIME ZONE,
  manager_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PM checklist items table
CREATE TABLE public.pm_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pm_id UUID NOT NULL REFERENCES public.store_preventive_maintenance(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  is_checked BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMP WITH TIME ZONE,
  checked_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PM attachments table
CREATE TABLE public.pm_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pm_id UUID NOT NULL REFERENCES public.store_preventive_maintenance(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_by VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add store_id to incidents table to link existing incidents to stores
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add asset_id to maintenance_tasks to link to assets
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_tasks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.store_asset_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_preventive_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth for now)
CREATE POLICY "Allow all access to store_asset_deployments" ON public.store_asset_deployments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to service_tickets" ON public.service_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to store_preventive_maintenance" ON public.store_preventive_maintenance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pm_checklist_items" ON public.pm_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pm_attachments" ON public.pm_attachments FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_store_asset_deployments_updated_at BEFORE UPDATE ON public.store_asset_deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_tickets_updated_at BEFORE UPDATE ON public.service_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_preventive_maintenance_updated_at BEFORE UPDATE ON public.store_preventive_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_store_asset_deployments_store ON public.store_asset_deployments(store_id);
CREATE INDEX idx_store_asset_deployments_asset ON public.store_asset_deployments(asset_id);
CREATE INDEX idx_service_tickets_store ON public.service_tickets(store_id);
CREATE INDEX idx_service_tickets_asset ON public.service_tickets(asset_id);
CREATE INDEX idx_service_tickets_status ON public.service_tickets(status);
CREATE INDEX idx_store_pm_store ON public.store_preventive_maintenance(store_id);
CREATE INDEX idx_store_pm_scheduled_date ON public.store_preventive_maintenance(scheduled_date);
CREATE INDEX idx_pm_checklist_pm ON public.pm_checklist_items(pm_id);
CREATE INDEX idx_pm_attachments_pm ON public.pm_attachments(pm_id);