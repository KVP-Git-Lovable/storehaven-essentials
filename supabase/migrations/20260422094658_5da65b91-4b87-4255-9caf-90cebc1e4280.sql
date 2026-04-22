-- Add user_initiated_approved column
ALTER TABLE public.whatsapp_templates
ADD COLUMN IF NOT EXISTS user_initiated_approved boolean NOT NULL DEFAULT false;

-- Backfill: any template with a twilio_content_sid that is not rejected/draft
UPDATE public.whatsapp_templates
SET user_initiated_approved = true
WHERE twilio_content_sid IS NOT NULL
  AND twilio_content_sid <> ''
  AND status IN ('approved', 'submitted', 'pending');

-- Ensure highvalue_8lakh is marked immediately
UPDATE public.whatsapp_templates
SET user_initiated_approved = true
WHERE twilio_content_sid = 'HX807de5f45cf0e60b26d89cb5d3617142'
   OR name = 'highvalue_8lakh';