
-- 1) journey_message_events: per-event audit log
CREATE TABLE public.journey_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  journey_step_id text,
  person_id uuid,
  entity_type text NOT NULL DEFAULT 'customer',
  whatsapp_message_sid text,
  template_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('sent','delivered','read','clicked','failed')),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jme_journey ON public.journey_message_events(journey_id);
CREATE INDEX idx_jme_person ON public.journey_message_events(person_id, entity_type);
CREATE INDEX idx_jme_sid ON public.journey_message_events(whatsapp_message_sid);
CREATE INDEX idx_jme_event_type ON public.journey_message_events(event_type);
-- Idempotency for status webhooks (clicks can repeat)
CREATE UNIQUE INDEX uq_jme_sid_event_nonclick
  ON public.journey_message_events(whatsapp_message_sid, event_type)
  WHERE event_type <> 'clicked' AND whatsapp_message_sid IS NOT NULL;

GRANT SELECT ON public.journey_message_events TO authenticated;
GRANT ALL ON public.journey_message_events TO service_role;

ALTER TABLE public.journey_message_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view journey_message_events"
  ON public.journey_message_events FOR SELECT TO authenticated USING (true);

-- 2) person_engagement_scores: cumulative score per recipient
CREATE TABLE public.person_engagement_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  entity_type text NOT NULL DEFAULT 'customer',
  whatsapp_score integer NOT NULL DEFAULT 0,
  total_messages_sent integer NOT NULL DEFAULT 0,
  total_delivered integer NOT NULL DEFAULT 0,
  total_read integer NOT NULL DEFAULT 0,
  total_clicked integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  last_engagement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, entity_type)
);

CREATE INDEX idx_pes_score ON public.person_engagement_scores(whatsapp_score DESC);

GRANT SELECT ON public.person_engagement_scores TO authenticated;
GRANT ALL ON public.person_engagement_scores TO service_role;

ALTER TABLE public.person_engagement_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view person_engagement_scores"
  ON public.person_engagement_scores FOR SELECT TO authenticated USING (true);

-- 3) whatsapp_tracked_links: short-token -> original URL mapping
CREATE TABLE public.whatsapp_tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  journey_id uuid REFERENCES public.journeys(id) ON DELETE CASCADE,
  journey_step_id text,
  person_id uuid,
  entity_type text NOT NULL DEFAULT 'customer',
  template_id uuid,
  original_url text NOT NULL,
  whatsapp_message_sid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wtl_journey ON public.whatsapp_tracked_links(journey_id);

GRANT ALL ON public.whatsapp_tracked_links TO service_role;

ALTER TABLE public.whatsapp_tracked_links ENABLE ROW LEVEL SECURITY;
-- No authenticated policies; only service_role accesses this table.

-- 4) Scoring trigger
CREATE OR REPLACE FUNCTION public.apply_engagement_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta integer := 0;
  sent_inc integer := 0;
  delivered_inc integer := 0;
  read_inc integer := 0;
  clicked_inc integer := 0;
  failed_inc integer := 0;
BEGIN
  IF NEW.person_id IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.event_type
    WHEN 'sent' THEN delta := 1; sent_inc := 1;
    WHEN 'delivered' THEN delta := 2; delivered_inc := 1;
    WHEN 'read' THEN delta := 5; read_inc := 1;
    WHEN 'clicked' THEN delta := 10; clicked_inc := 1;
    WHEN 'failed' THEN delta := -2; failed_inc := 1;
    ELSE delta := 0;
  END CASE;

  INSERT INTO public.person_engagement_scores AS pes (
    person_id, entity_type, whatsapp_score,
    total_messages_sent, total_delivered, total_read, total_clicked, total_failed,
    last_engagement_at
  ) VALUES (
    NEW.person_id, COALESCE(NEW.entity_type, 'customer'), delta,
    sent_inc, delivered_inc, read_inc, clicked_inc, failed_inc,
    NEW.event_timestamp
  )
  ON CONFLICT (person_id, entity_type) DO UPDATE
  SET
    whatsapp_score = pes.whatsapp_score + EXCLUDED.whatsapp_score,
    total_messages_sent = pes.total_messages_sent + EXCLUDED.total_messages_sent,
    total_delivered = pes.total_delivered + EXCLUDED.total_delivered,
    total_read = pes.total_read + EXCLUDED.total_read,
    total_clicked = pes.total_clicked + EXCLUDED.total_clicked,
    total_failed = pes.total_failed + EXCLUDED.total_failed,
    last_engagement_at = GREATEST(COALESCE(pes.last_engagement_at, EXCLUDED.last_engagement_at), EXCLUDED.last_engagement_at),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER journey_message_events_score_trg
AFTER INSERT ON public.journey_message_events
FOR EACH ROW EXECUTE FUNCTION public.apply_engagement_event();
