
CREATE TABLE public.journey_excluded_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id UUID NOT NULL,
  phone_last10 TEXT NOT NULL,
  contact_id UUID,
  error_code TEXT,
  reason TEXT,
  excluded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (journey_id, phone_last10)
);
CREATE INDEX idx_jec_journey ON public.journey_excluded_contacts(journey_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_excluded_contacts TO authenticated;
GRANT ALL ON public.journey_excluded_contacts TO service_role;
ALTER TABLE public.journey_excluded_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view exclusions" ON public.journey_excluded_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert exclusions" ON public.journey_excluded_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete exclusions" ON public.journey_excluded_contacts FOR DELETE TO authenticated USING (true);
