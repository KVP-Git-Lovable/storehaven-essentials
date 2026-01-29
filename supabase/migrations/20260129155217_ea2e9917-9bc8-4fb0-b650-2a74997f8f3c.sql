-- Add service contract linkage and SLA tracking fields to service_tickets
ALTER TABLE public.service_tickets 
ADD COLUMN IF NOT EXISTS service_contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS first_response_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS response_time_mins integer,
ADD COLUMN IF NOT EXISTS sla_response_met boolean,
ADD COLUMN IF NOT EXISTS sla_resolution_met boolean,
ADD COLUMN IF NOT EXISTS service_score numeric(5,2),
ADD COLUMN IF NOT EXISTS spares_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS spares_cost numeric(12,2),
ADD COLUMN IF NOT EXISTS labour_hours numeric(8,2),
ADD COLUMN IF NOT EXISTS labour_cost numeric(12,2),
ADD COLUMN IF NOT EXISTS travel_distance_km numeric(8,2),
ADD COLUMN IF NOT EXISTS travel_cost numeric(12,2);

-- Create service_ticket_adherence table for checklist tracking
CREATE TABLE IF NOT EXISTS public.service_ticket_adherence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'sla', 'spares', 'labour', 'travel', 'response', 'consumables'
  item_name text NOT NULL,
  expected_value text,
  actual_value text,
  is_compliant boolean DEFAULT false,
  weight numeric(3,2) DEFAULT 1.00, -- weight for score calculation
  notes text,
  checked_at timestamp with time zone,
  checked_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_ticket_adherence ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_ticket_adherence
CREATE POLICY "Enable read access for all users" ON public.service_ticket_adherence
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.service_ticket_adherence
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.service_ticket_adherence
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.service_ticket_adherence
  FOR DELETE USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_service_ticket_adherence_ticket ON public.service_ticket_adherence(service_ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_contract ON public.service_tickets(service_contract_id);