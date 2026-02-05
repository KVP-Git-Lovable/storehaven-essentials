-- Add budget fields to nso_checklist_masters table
ALTER TABLE public.nso_checklist_masters
ADD COLUMN IF NOT EXISTS estimated_budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_budget numeric DEFAULT 0;