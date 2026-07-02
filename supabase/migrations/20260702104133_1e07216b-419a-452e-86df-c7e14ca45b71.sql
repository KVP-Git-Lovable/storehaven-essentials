-- Create email_message_log table for the SendGrid email integration
CREATE TABLE public.email_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT 'info@quickapp.ai',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  sendgrid_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.email_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email logs"
  ON public.email_message_log FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create email logs"
  ON public.email_message_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sent_by);
