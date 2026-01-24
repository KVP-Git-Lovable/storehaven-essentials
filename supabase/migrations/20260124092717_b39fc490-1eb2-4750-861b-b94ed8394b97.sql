-- New Store Opening Checklist Masters (templates by store type)
CREATE TABLE public.nso_checklist_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  store_type TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sections within a master checklist
CREATE TABLE public.nso_master_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_id UUID NOT NULL REFERENCES public.nso_checklist_masters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tasks within a master section
CREATE TABLE public.nso_master_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.nso_master_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store checklist assignments (when a master is assigned to a store)
CREATE TABLE public.nso_store_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_id UUID REFERENCES public.nso_checklist_masters(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sections for a store checklist (copied from master or custom)
CREATE TABLE public.nso_store_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.nso_store_checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tasks for a store checklist
CREATE TABLE public.nso_store_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.nso_store_sections(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES public.nso_store_checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task attachments
CREATE TABLE public.nso_task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.nso_store_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.nso_checklist_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_master_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_master_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_store_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_store_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_store_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nso_task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nso_checklist_masters
CREATE POLICY "Allow public read access" ON public.nso_checklist_masters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_checklist_masters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_checklist_masters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_checklist_masters FOR DELETE USING (true);

-- RLS Policies for nso_master_sections
CREATE POLICY "Allow public read access" ON public.nso_master_sections FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_master_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_master_sections FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_master_sections FOR DELETE USING (true);

-- RLS Policies for nso_master_tasks
CREATE POLICY "Allow public read access" ON public.nso_master_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_master_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_master_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_master_tasks FOR DELETE USING (true);

-- RLS Policies for nso_store_checklists
CREATE POLICY "Allow public read access" ON public.nso_store_checklists FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_store_checklists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_store_checklists FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_store_checklists FOR DELETE USING (true);

-- RLS Policies for nso_store_sections
CREATE POLICY "Allow public read access" ON public.nso_store_sections FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_store_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_store_sections FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_store_sections FOR DELETE USING (true);

-- RLS Policies for nso_store_tasks
CREATE POLICY "Allow public read access" ON public.nso_store_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_store_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_store_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_store_tasks FOR DELETE USING (true);

-- RLS Policies for nso_task_attachments
CREATE POLICY "Allow public read access" ON public.nso_task_attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.nso_task_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.nso_task_attachments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.nso_task_attachments FOR DELETE USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_nso_master_sections_master ON public.nso_master_sections(master_id);
CREATE INDEX idx_nso_master_tasks_section ON public.nso_master_tasks(section_id);
CREATE INDEX idx_nso_store_checklists_store ON public.nso_store_checklists(store_id);
CREATE INDEX idx_nso_store_sections_checklist ON public.nso_store_sections(checklist_id);
CREATE INDEX idx_nso_store_tasks_section ON public.nso_store_tasks(section_id);
CREATE INDEX idx_nso_store_tasks_checklist ON public.nso_store_tasks(checklist_id);
CREATE INDEX idx_nso_task_attachments_task ON public.nso_task_attachments(task_id);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('nso-attachments', 'nso-attachments', true);

-- Storage policies for nso-attachments bucket
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING (bucket_id = 'nso-attachments');
CREATE POLICY "Allow public upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'nso-attachments');
CREATE POLICY "Allow public update access" ON storage.objects FOR UPDATE USING (bucket_id = 'nso-attachments');
CREATE POLICY "Allow public delete access" ON storage.objects FOR DELETE USING (bucket_id = 'nso-attachments');