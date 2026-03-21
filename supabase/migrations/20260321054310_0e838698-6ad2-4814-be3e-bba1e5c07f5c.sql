
-- Checklist items defined at the Task Master level
CREATE TABLE public.task_master_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_master_id UUID NOT NULL REFERENCES public.task_master(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checklist completion tracking per task instance
CREATE TABLE public.task_instance_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_instance_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.task_master_checklist_items(id) ON DELETE CASCADE,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  checked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_instance_id, checklist_item_id)
);

-- Indexes
CREATE INDEX idx_task_master_checklist_task ON public.task_master_checklist_items(task_master_id);
CREATE INDEX idx_task_instance_checklist_instance ON public.task_instance_checklist_items(task_instance_id);

-- RLS
ALTER TABLE public.task_master_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instance_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task master checklist items"
ON public.task_master_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage task master checklist items"
ON public.task_master_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view task instance checklist items"
ON public.task_instance_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage task instance checklist items"
ON public.task_instance_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
