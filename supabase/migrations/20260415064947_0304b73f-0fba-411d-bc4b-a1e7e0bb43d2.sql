
-- Create whatsapp_templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  language TEXT NOT NULL DEFAULT 'en',
  body TEXT NOT NULL,
  twilio_content_sid TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  rejection_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create whatsapp_message_log table
CREATE TABLE public.whatsapp_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE CASCADE,
  to_number TEXT NOT NULL,
  twilio_message_sid TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_templates
CREATE POLICY "Authenticated users can view templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create templates"
  ON public.whatsapp_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update any template"
  ON public.whatsapp_templates FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

CREATE POLICY "Admins can delete templates"
  ON public.whatsapp_templates FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR auth.uid() = created_by);

-- RLS policies for whatsapp_message_log
CREATE POLICY "Authenticated users can view message logs"
  ON public.whatsapp_message_log FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create message logs"
  ON public.whatsapp_message_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sent_by);

-- Triggers for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
