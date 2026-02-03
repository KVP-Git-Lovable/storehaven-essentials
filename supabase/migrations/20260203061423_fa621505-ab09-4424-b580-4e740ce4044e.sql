-- Add scheduled time columns to vm_compliance_tasks table
ALTER TABLE public.vm_compliance_tasks
ADD COLUMN scheduled_start_time TIME WITHOUT TIME ZONE DEFAULT NULL,
ADD COLUMN scheduled_end_time TIME WITHOUT TIME ZONE DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.vm_compliance_tasks.scheduled_start_time IS 'Optional scheduled start time for the task';
COMMENT ON COLUMN public.vm_compliance_tasks.scheduled_end_time IS 'Optional scheduled end time for the task';