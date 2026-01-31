-- Add PM checklist master reference to maintenance_tasks
ALTER TABLE public.maintenance_tasks
ADD COLUMN pm_checklist_master_id UUID REFERENCES public.pm_checklist_masters(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_maintenance_tasks_pm_checklist_master_id ON public.maintenance_tasks(pm_checklist_master_id);

-- Add comment for documentation
COMMENT ON COLUMN public.maintenance_tasks.pm_checklist_master_id IS 'Links to PM Checklist Master template for this maintenance task';