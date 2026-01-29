-- Drop and recreate service_contracts table with comprehensive structure
DROP TABLE IF EXISTS service_contract_assets;
DROP TABLE IF EXISTS service_contracts;

-- Create comprehensive service_contracts table
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number TEXT NOT NULL,
  
  -- Section 1: Parties and Definitions
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  service_provider_id UUID REFERENCES public.vendors(id),
  effective_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renewal BOOLEAN DEFAULT false,
  renewal_notice_days INTEGER DEFAULT 30,
  
  -- Section 2: Contract Scope
  contract_type TEXT NOT NULL DEFAULT 'amc', -- amc, warranty, sla, hybrid
  service_types TEXT[] DEFAULT '{}', -- pm, breakdown, remote, onsite, installation, decommissioning
  
  -- Section 3: Coverage and Entitlements
  labour_included BOOLEAN DEFAULT true,
  travel_included BOOLEAN DEFAULT true,
  travel_radius_km INTEGER,
  spares_included BOOLEAN DEFAULT false,
  consumables_included BOOLEAN DEFAULT false,
  consumables_limit NUMERIC,
  
  -- Section 4: Exclusions
  exclusions TEXT,
  
  -- Section 5: SLA
  support_hours TEXT DEFAULT 'business', -- business, 24x7, custom
  support_hours_custom TEXT,
  p1_response_mins INTEGER,
  p1_resolution_hrs INTEGER,
  p2_response_mins INTEGER,
  p2_resolution_hrs INTEGER,
  p3_response_mins INTEGER,
  p3_resolution_hrs INTEGER,
  p4_response_mins INTEGER,
  p4_resolution_hrs INTEGER,
  sla_penalties BOOLEAN DEFAULT false,
  sla_penalty_details TEXT,
  
  -- Section 6: PM Program
  pm_frequency TEXT, -- monthly, quarterly, biannual, annual, meter-based
  pm_checklist_attached BOOLEAN DEFAULT false,
  
  -- Section 9: Uptime Commitments
  target_uptime_percent NUMERIC,
  uptime_measurement_method TEXT,
  
  -- Section 12: Commercial Terms
  pricing_model TEXT DEFAULT 'fixed', -- fixed, per-call, time-material, hybrid
  contract_value NUMERIC NOT NULL DEFAULT 0,
  visit_charge NUMERIC,
  after_hours_multiplier NUMERIC DEFAULT 1.5,
  invoice_frequency TEXT DEFAULT 'monthly', -- monthly, quarterly, annual, on-completion
  payment_terms_days INTEGER DEFAULT 30,
  annual_escalation_percent NUMERIC,
  
  -- Escalation Matrix
  escalation_l1_name TEXT,
  escalation_l1_phone TEXT,
  escalation_l1_email TEXT,
  escalation_l2_name TEXT,
  escalation_l2_phone TEXT,
  escalation_l2_email TEXT,
  escalation_l3_name TEXT,
  escalation_l3_phone TEXT,
  escalation_l3_email TEXT,
  
  -- Status and Meta
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, expiring, expired, terminated
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_contract_assets junction table
CREATE TABLE public.service_contract_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_contract_id, asset_id)
);

-- Create service_contract_locations table
CREATE TABLE public.service_contract_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_contract_id, store_id)
);

-- Create service_contract_attachments table
CREATE TABLE public.service_contract_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  attachment_type TEXT DEFAULT 'contract', -- contract, sla, pm_checklist, rate_card, other
  uploaded_by TEXT DEFAULT 'System',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_contracts
CREATE POLICY "Allow public read access" ON public.service_contracts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contracts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contracts FOR DELETE USING (true);

-- RLS Policies for service_contract_assets
CREATE POLICY "Allow public read access" ON public.service_contract_assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contract_assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contract_assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contract_assets FOR DELETE USING (true);

-- RLS Policies for service_contract_locations
CREATE POLICY "Allow public read access" ON public.service_contract_locations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contract_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contract_locations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contract_locations FOR DELETE USING (true);

-- RLS Policies for service_contract_attachments
CREATE POLICY "Allow public read access" ON public.service_contract_attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contract_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contract_attachments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contract_attachments FOR DELETE USING (true);

-- Create storage bucket for contract attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('service-contracts', 'service-contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Allow public read service-contracts" ON storage.objects FOR SELECT USING (bucket_id = 'service-contracts');
CREATE POLICY "Allow public upload service-contracts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'service-contracts');
CREATE POLICY "Allow public update service-contracts" ON storage.objects FOR UPDATE USING (bucket_id = 'service-contracts');
CREATE POLICY "Allow public delete service-contracts" ON storage.objects FOR DELETE USING (bucket_id = 'service-contracts');

-- Indexes
CREATE INDEX idx_service_contracts_status ON public.service_contracts(status);
CREATE INDEX idx_service_contracts_end_date ON public.service_contracts(end_date);
CREATE INDEX idx_service_contract_assets_contract ON public.service_contract_assets(service_contract_id);
CREATE INDEX idx_service_contract_locations_contract ON public.service_contract_locations(service_contract_id);
CREATE INDEX idx_service_contract_attachments_contract ON public.service_contract_attachments(service_contract_id);