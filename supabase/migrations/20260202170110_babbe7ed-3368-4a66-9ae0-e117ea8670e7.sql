-- Add assigned_to_user_id (UUID) to link to profiles table
ALTER TABLE public.vm_compliance_tasks 
  ADD COLUMN assigned_to_user_id UUID REFERENCES public.profiles(id);

-- Add parent_task_id for recurring task chain tracking
ALTER TABLE public.vm_compliance_tasks 
  ADD COLUMN parent_task_id UUID REFERENCES public.vm_compliance_tasks(id);

-- Add is_recurring flag for easy filtering
ALTER TABLE public.vm_compliance_tasks 
  ADD COLUMN is_recurring BOOLEAN DEFAULT false;