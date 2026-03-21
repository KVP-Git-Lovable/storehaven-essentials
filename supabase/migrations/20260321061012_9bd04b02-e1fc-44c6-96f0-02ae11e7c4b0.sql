
-- Add baseline_photo_url to task_master for reference/prescribed photo
ALTER TABLE public.task_master ADD COLUMN IF NOT EXISTS baseline_photo_url text;

-- Add compliance fields to task_instances
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS submitted_photo_url text;
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS compliance_score numeric;
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS compliance_status text;
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS compliance_reasoning text;
