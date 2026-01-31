-- Add category to service tickets (aligned with KB category dropdown values)
ALTER TABLE public.service_tickets
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

-- Optional index for filtering/reporting
CREATE INDEX IF NOT EXISTS idx_service_tickets_category ON public.service_tickets (category);