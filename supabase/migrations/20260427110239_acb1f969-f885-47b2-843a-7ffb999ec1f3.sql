
CREATE TABLE public.whatsapp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  customer_id uuid NULL,
  customer_name text NULL,
  request_type text NOT NULL DEFAULT 'Assistance',
  message_text text NULL,
  city text NULL,
  conversation_phone text NOT NULL,
  inbound_message_id uuid NULL,
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_requests_phone ON public.whatsapp_requests (phone_number);
CREATE INDEX idx_whatsapp_requests_status ON public.whatsapp_requests (status);
CREATE INDEX idx_whatsapp_requests_created_at ON public.whatsapp_requests (created_at DESC);

ALTER TABLE public.whatsapp_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp requests"
  ON public.whatsapp_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update whatsapp requests"
  ON public.whatsapp_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert whatsapp requests"
  ON public.whatsapp_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TRIGGER update_whatsapp_requests_updated_at
  BEFORE UPDATE ON public.whatsapp_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_requests;
ALTER TABLE public.whatsapp_requests REPLICA IDENTITY FULL;
