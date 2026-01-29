-- Add PM checklist items array to service_contracts
ALTER TABLE public.service_contracts 
ADD COLUMN IF NOT EXISTS pm_checklist_items text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pm_task_type text DEFAULT 'preventive-maintenance';

-- Add reference to service_contract in maintenance_tasks table for tracking auto-created PM
ALTER TABLE public.maintenance_tasks 
ADD COLUMN IF NOT EXISTS service_contract_id uuid REFERENCES public.service_contracts(id) ON DELETE SET NULL;