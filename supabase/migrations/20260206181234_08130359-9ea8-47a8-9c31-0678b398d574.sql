
-- Create master task attachments table (for NSO Checklist Master template-level attachments)
CREATE TABLE public.nso_master_task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.nso_master_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL DEFAULT 'current_user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nso_master_task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as nso_task_attachments - allow all authenticated users)
CREATE POLICY "Allow all operations on nso_master_task_attachments"
  ON public.nso_master_task_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);
