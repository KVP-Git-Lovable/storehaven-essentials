
-- Enable RLS on PM Checklist tables
ALTER TABLE public.pm_checklist_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_master_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_master_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for pm_checklist_masters
CREATE POLICY "Allow public read access" ON public.pm_checklist_masters FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pm_checklist_masters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pm_checklist_masters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.pm_checklist_masters FOR DELETE USING (true);

-- Create policies for pm_master_sections
CREATE POLICY "Allow public read access" ON public.pm_master_sections FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pm_master_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pm_master_sections FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.pm_master_sections FOR DELETE USING (true);

-- Create policies for pm_master_tasks
CREATE POLICY "Allow public read access" ON public.pm_master_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pm_master_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pm_master_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.pm_master_tasks FOR DELETE USING (true);

-- Create policies for pm_task_attachments
CREATE POLICY "Allow public read access" ON public.pm_task_attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pm_task_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pm_task_attachments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.pm_task_attachments FOR DELETE USING (true);
