-- Add compliance_status for automated tracking (open, delayed, completed_on_time, completed_but_delayed)
ALTER TABLE public.vm_compliance_tasks 
ADD COLUMN IF NOT EXISTS compliance_status text NOT NULL DEFAULT 'open';

-- Add review_status for manual review (match, average_match, low_match, no_match)
ALTER TABLE public.vm_compliance_tasks 
ADD COLUMN IF NOT EXISTS review_status text;

-- Add match_percentage for image comparison score
ALTER TABLE public.vm_compliance_tasks 
ADD COLUMN IF NOT EXISTS match_percentage numeric;

-- Add check constraint for compliance_status values
ALTER TABLE public.vm_compliance_tasks 
ADD CONSTRAINT vm_compliance_tasks_compliance_status_check 
CHECK (compliance_status IN ('open', 'delayed', 'completed_on_time', 'completed_but_delayed'));

-- Add check constraint for review_status values
ALTER TABLE public.vm_compliance_tasks 
ADD CONSTRAINT vm_compliance_tasks_review_status_check 
CHECK (review_status IS NULL OR review_status IN ('match', 'average_match', 'low_match', 'no_match'));

-- Create function to auto-update compliance_status
CREATE OR REPLACE FUNCTION public.update_compliance_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If photo is being submitted (submitted_at is being set)
  IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
    -- Check if submission is on time (before or on due date)
    IF NEW.submitted_at <= NEW.due_date THEN
      NEW.compliance_status := 'completed_on_time';
    ELSE
      NEW.compliance_status := 'completed_but_delayed';
    END IF;
  -- If no photo and past due date
  ELSIF NEW.submitted_at IS NULL AND NEW.due_date < NOW() AND NEW.compliance_status = 'open' THEN
    NEW.compliance_status := 'delayed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update compliance_status on update
DROP TRIGGER IF EXISTS trigger_update_compliance_status ON public.vm_compliance_tasks;
CREATE TRIGGER trigger_update_compliance_status
BEFORE UPDATE ON public.vm_compliance_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_compliance_status();

-- Create a function to mark overdue tasks as delayed (to be called periodically)
CREATE OR REPLACE FUNCTION public.mark_overdue_compliance_tasks()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.vm_compliance_tasks
  SET compliance_status = 'delayed'
  WHERE compliance_status = 'open'
    AND due_date < NOW()
    AND submitted_at IS NULL;
END;
$$;