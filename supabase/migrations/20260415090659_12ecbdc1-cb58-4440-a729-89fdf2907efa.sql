
-- journey_contacts
CREATE TABLE public.journey_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text,
  date_of_birth date,
  last_purchase_date timestamptz,
  segment_type text NOT NULL DEFAULT 'customer',
  opted_out boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journey_contacts" ON public.journey_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journey_contacts" ON public.journey_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update journey_contacts" ON public.journey_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete journey_contacts" ON public.journey_contacts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_journey_contacts_updated_at BEFORE UPDATE ON public.journey_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- journey_contact_events
CREATE TABLE public.journey_contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.journey_contacts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_contact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journey_contact_events" ON public.journey_contact_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journey_contact_events" ON public.journey_contact_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete journey_contact_events" ON public.journey_contact_events FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- journeys
CREATE TABLE public.journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  canvas_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_type text,
  filters jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journeys" ON public.journeys FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journeys" ON public.journeys FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update journeys" ON public.journeys FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete journeys" ON public.journeys FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_journeys_updated_at BEFORE UPDATE ON public.journeys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- journey_enrollments
CREATE TABLE public.journey_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.journey_contacts(id) ON DELETE CASCADE,
  current_node_id text,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_action_at timestamptz
);

ALTER TABLE public.journey_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journey_enrollments" ON public.journey_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journey_enrollments" ON public.journey_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update journey_enrollments" ON public.journey_enrollments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete journey_enrollments" ON public.journey_enrollments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Enable realtime on journey_enrollments
ALTER PUBLICATION supabase_realtime ADD TABLE public.journey_enrollments;

-- journey_message_log
CREATE TABLE public.journey_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.journey_enrollments(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES public.journey_contacts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  template_body text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view journey_message_log" ON public.journey_message_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert journey_message_log" ON public.journey_message_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete journey_message_log" ON public.journey_message_log FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_journey_contacts_segment ON public.journey_contacts(segment_type);
CREATE INDEX idx_journey_contacts_city ON public.journey_contacts(city);
CREATE INDEX idx_journey_contact_events_contact ON public.journey_contact_events(contact_id);
CREATE INDEX idx_journey_contact_events_type ON public.journey_contact_events(event_type);
CREATE INDEX idx_journey_enrollments_journey ON public.journey_enrollments(journey_id);
CREATE INDEX idx_journey_enrollments_next_action ON public.journey_enrollments(next_action_at) WHERE status = 'active';
CREATE INDEX idx_journey_message_log_journey ON public.journey_message_log(journey_id);
CREATE INDEX idx_journey_message_log_contact ON public.journey_message_log(contact_id);
