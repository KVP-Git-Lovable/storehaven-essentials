CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_number text,
  business_name text NOT NULL DEFAULT 'QuickApp',
  webhook_url text,
  throughput text NOT NULL DEFAULT '80 messages per second',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp config"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert whatsapp config"
  ON public.whatsapp_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update whatsapp config"
  ON public.whatsapp_config FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_config (webhook_url, business_name, throughput)
VALUES (
  'https://fukkurwmuxcyoyqwchdb.supabase.co/functions/v1/whatsapp-inbound',
  'QuickApp',
  '80 messages per second'
);