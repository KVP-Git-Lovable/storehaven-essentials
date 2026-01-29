
-- Create PM Checklist Masters table
CREATE TABLE public.pm_checklist_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  asset_master_id UUID REFERENCES public.asset_masters(id),
  brand TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('Preventive Maintenance', 'Routine Inspection', 'Deep Cleaning', 'Calibration')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PM Master Sections table
CREATE TABLE public.pm_master_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_id UUID NOT NULL REFERENCES public.pm_checklist_masters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PM Master Tasks table
CREATE TABLE public.pm_master_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.pm_master_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instruction TEXT,
  duration_hours NUMERIC(5,2) DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create PM Task Attachments table
CREATE TABLE public.pm_task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.pm_master_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_pm_master_sections_master_id ON public.pm_master_sections(master_id);
CREATE INDEX idx_pm_master_tasks_section_id ON public.pm_master_tasks(section_id);
CREATE INDEX idx_pm_task_attachments_task_id ON public.pm_task_attachments(task_id);

-- Add trigger for updated_at
CREATE TRIGGER update_pm_checklist_masters_updated_at
  BEFORE UPDATE ON public.pm_checklist_masters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
