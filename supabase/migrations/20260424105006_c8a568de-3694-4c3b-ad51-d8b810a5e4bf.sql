-- Add template_id to journey_message_log for attribution
ALTER TABLE public.journey_message_log
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journey_message_log_template_id 
  ON public.journey_message_log(template_id);

CREATE INDEX IF NOT EXISTS idx_journey_message_log_journey_template 
  ON public.journey_message_log(journey_id, template_id);

-- Create whatsapp_link_clicks table
CREATE TABLE IF NOT EXISTS public.whatsapp_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  template_sid text NOT NULL,
  journey_id uuid REFERENCES public.journeys(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_phone 
  ON public.whatsapp_link_clicks(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_template_sid 
  ON public.whatsapp_link_clicks(template_sid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_journey 
  ON public.whatsapp_link_clicks(journey_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_clicks_phone_template 
  ON public.whatsapp_link_clicks(phone_number, template_sid);

ALTER TABLE public.whatsapp_link_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert click records (public portal endpoint logs them)
CREATE POLICY "Anyone can insert link clicks"
  ON public.whatsapp_link_clicks
  FOR INSERT
  WITH CHECK (true);

-- Authenticated users can view click records
CREATE POLICY "Authenticated users can view link clicks"
  ON public.whatsapp_link_clicks
  FOR SELECT
  TO authenticated
  USING (true);