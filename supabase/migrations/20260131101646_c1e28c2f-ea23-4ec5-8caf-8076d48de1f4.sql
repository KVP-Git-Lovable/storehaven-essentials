-- Add asset_master_id and vendor_id lookups to inventory_items
ALTER TABLE public.inventory_items
ADD COLUMN asset_master_id UUID REFERENCES public.asset_masters(id) ON DELETE SET NULL,
ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
ADD COLUMN rate_validity_date DATE,
ADD COLUMN rate_validity_days INTEGER;

-- Create indexes for the new lookup columns
CREATE INDEX idx_inventory_items_asset_master_id ON public.inventory_items(asset_master_id);
CREATE INDEX idx_inventory_items_vendor_id ON public.inventory_items(vendor_id);

-- Add comments
COMMENT ON COLUMN public.inventory_items.asset_master_id IS 'Links to Asset Master for spare parts';
COMMENT ON COLUMN public.inventory_items.vendor_id IS 'Default vendor for this item';
COMMENT ON COLUMN public.inventory_items.rate_validity_date IS 'Date until which the rate is valid';
COMMENT ON COLUMN public.inventory_items.rate_validity_days IS 'Number of days the rate is valid from last update';

-- Create table for tracking spares used in service tickets
CREATE TABLE public.service_ticket_spares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  asset_master_id UUID REFERENCES public.asset_masters(id) ON DELETE SET NULL,
  spare_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  is_covered_by_contract BOOLEAN NOT NULL DEFAULT false,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create table for tracking labour costs in service tickets
CREATE TABLE public.service_ticket_labour (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT 'Labour',
  total_cost NUMERIC(12,2) NOT NULL,
  is_covered_by_contract BOOLEAN NOT NULL DEFAULT false,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create table for tracking spares used in preventive maintenance
CREATE TABLE public.maintenance_task_spares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  asset_master_id UUID REFERENCES public.asset_masters(id) ON DELETE SET NULL,
  spare_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  is_covered_by_contract BOOLEAN NOT NULL DEFAULT false,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create table for tracking labour costs in preventive maintenance
CREATE TABLE public.maintenance_task_labour (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT 'Labour',
  total_cost NUMERIC(12,2) NOT NULL,
  is_covered_by_contract BOOLEAN NOT NULL DEFAULT false,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create indexes
CREATE INDEX idx_service_ticket_spares_ticket_id ON public.service_ticket_spares(ticket_id);
CREATE INDEX idx_service_ticket_labour_ticket_id ON public.service_ticket_labour(ticket_id);
CREATE INDEX idx_maintenance_task_spares_task_id ON public.maintenance_task_spares(task_id);
CREATE INDEX idx_maintenance_task_labour_task_id ON public.maintenance_task_labour(task_id);

-- Enable RLS on new tables
ALTER TABLE public.service_ticket_spares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ticket_labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_task_spares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_task_labour ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service_ticket_spares
CREATE POLICY "Allow authenticated users to view service_ticket_spares"
  ON public.service_ticket_spares FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert service_ticket_spares"
  ON public.service_ticket_spares FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update service_ticket_spares"
  ON public.service_ticket_spares FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete service_ticket_spares"
  ON public.service_ticket_spares FOR DELETE
  TO authenticated USING (true);

-- Create RLS policies for service_ticket_labour
CREATE POLICY "Allow authenticated users to view service_ticket_labour"
  ON public.service_ticket_labour FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert service_ticket_labour"
  ON public.service_ticket_labour FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update service_ticket_labour"
  ON public.service_ticket_labour FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete service_ticket_labour"
  ON public.service_ticket_labour FOR DELETE
  TO authenticated USING (true);

-- Create RLS policies for maintenance_task_spares
CREATE POLICY "Allow authenticated users to view maintenance_task_spares"
  ON public.maintenance_task_spares FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert maintenance_task_spares"
  ON public.maintenance_task_spares FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update maintenance_task_spares"
  ON public.maintenance_task_spares FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete maintenance_task_spares"
  ON public.maintenance_task_spares FOR DELETE
  TO authenticated USING (true);

-- Create RLS policies for maintenance_task_labour
CREATE POLICY "Allow authenticated users to view maintenance_task_labour"
  ON public.maintenance_task_labour FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert maintenance_task_labour"
  ON public.maintenance_task_labour FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update maintenance_task_labour"
  ON public.maintenance_task_labour FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete maintenance_task_labour"
  ON public.maintenance_task_labour FOR DELETE
  TO authenticated USING (true);