
-- Create daily_rosters table
CREATE TABLE public.daily_rosters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  roster_date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.role_master(id),
  shift_type TEXT NOT NULL DEFAULT 'morning',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, roster_date, employee_id)
);

-- Enable RLS
ALTER TABLE public.daily_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rosters" ON public.daily_rosters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create rosters" ON public.daily_rosters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rosters" ON public.daily_rosters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete rosters" ON public.daily_rosters FOR DELETE TO authenticated USING (true);

-- Add assigned_employee_id to task_instances
ALTER TABLE public.task_instances ADD COLUMN assigned_employee_id UUID REFERENCES public.employees(id);

-- Index for fast roster lookups
CREATE INDEX idx_daily_rosters_store_date ON public.daily_rosters(store_id, roster_date);
CREATE INDEX idx_task_instances_assigned_employee ON public.task_instances(assigned_employee_id);
