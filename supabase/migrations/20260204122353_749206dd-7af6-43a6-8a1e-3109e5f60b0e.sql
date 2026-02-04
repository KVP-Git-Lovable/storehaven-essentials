-- Add budget-related fields to NSO Checklist Masters
ALTER TABLE public.nso_checklist_masters
ADD COLUMN planned_budget numeric DEFAULT 0,
ADD COLUMN prescribed_sqft numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.nso_checklist_masters.planned_budget IS 'Admin/Store Manager defined expected budget for this NSO';
COMMENT ON COLUMN public.nso_checklist_masters.prescribed_sqft IS 'Square footage for prescribed budget calculation';