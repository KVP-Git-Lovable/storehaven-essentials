CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message text,
  message_type text NOT NULL DEFAULT 'text',
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent',
  twilio_message_sid text NULL,
  profile_name text NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_phone_created ON public.whatsapp_messages (phone, created_at DESC);
CREATE INDEX idx_whatsapp_messages_customer ON public.whatsapp_messages (customer_id);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages (created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert whatsapp messages"
ON public.whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update whatsapp messages"
ON public.whatsapp_messages FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete whatsapp messages"
ON public.whatsapp_messages FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;