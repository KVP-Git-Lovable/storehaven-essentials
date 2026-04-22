
-- Store full Twilio Content API definition on whatsapp_templates
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS twilio_content_types jsonb,
  ADD COLUMN IF NOT EXISTS twilio_template_type text,
  ADD COLUMN IF NOT EXISTS twilio_media_url text,
  ADD COLUMN IF NOT EXISTS twilio_media_is_variable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_required_variables jsonb,
  ADD COLUMN IF NOT EXISTS twilio_synced_at timestamptz;

-- Track real downstream delivery state on journey_message_log
ALTER TABLE public.journey_message_log
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb;

-- Index by twilio_message_sid so the inbound status callback can find the row fast
CREATE INDEX IF NOT EXISTS journey_message_log_twilio_sid_idx
  ON public.journey_message_log (twilio_message_sid);
