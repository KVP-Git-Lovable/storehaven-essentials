-- Drop any existing partial/unique index with same columns to avoid duplication
DROP INDEX IF EXISTS public.journey_message_events_sid_event_uq;

-- Add real unique constraint (required for ON CONFLICT target)
ALTER TABLE public.journey_message_events
  ADD CONSTRAINT journey_message_events_sid_event_uq
  UNIQUE (whatsapp_message_sid, event_type);

-- Backfill
INSERT INTO public.journey_message_events
  (journey_id, journey_step_id, person_id, entity_type, whatsapp_message_sid, template_id, event_type, event_timestamp)
SELECT jml.journey_id, jml.node_id, jml.contact_id,
       COALESCE(jc.segment_type, 'customer'),
       jml.twilio_message_sid, jml.template_id, 'sent',
       COALESCE(jml.sent_at, now())
FROM public.journey_message_log jml
LEFT JOIN public.journey_contacts jc ON jc.id = jml.contact_id
WHERE jml.twilio_message_sid IS NOT NULL
ON CONFLICT (whatsapp_message_sid, event_type) DO NOTHING;

INSERT INTO public.journey_message_events
  (journey_id, journey_step_id, person_id, entity_type, whatsapp_message_sid, template_id, event_type, event_timestamp)
SELECT jml.journey_id, jml.node_id, jml.contact_id,
       COALESCE(jc.segment_type, 'customer'),
       jml.twilio_message_sid, jml.template_id, 'delivered',
       COALESCE(jml.sent_at, now())
FROM public.journey_message_log jml
LEFT JOIN public.journey_contacts jc ON jc.id = jml.contact_id
WHERE jml.twilio_message_sid IS NOT NULL
  AND (jml.delivery_status = 'delivered' OR jml.status IN ('delivered','read'))
ON CONFLICT (whatsapp_message_sid, event_type) DO NOTHING;

INSERT INTO public.journey_message_events
  (journey_id, journey_step_id, person_id, entity_type, whatsapp_message_sid, template_id, event_type, event_timestamp)
SELECT jml.journey_id, jml.node_id, jml.contact_id,
       COALESCE(jc.segment_type, 'customer'),
       jml.twilio_message_sid, jml.template_id, 'read',
       COALESCE(jml.sent_at, now())
FROM public.journey_message_log jml
LEFT JOIN public.journey_contacts jc ON jc.id = jml.contact_id
WHERE jml.twilio_message_sid IS NOT NULL
  AND jml.status = 'read'
ON CONFLICT (whatsapp_message_sid, event_type) DO NOTHING;

INSERT INTO public.journey_message_events
  (journey_id, journey_step_id, person_id, entity_type, whatsapp_message_sid, template_id, event_type, event_timestamp)
SELECT jml.journey_id, jml.node_id, jml.contact_id,
       COALESCE(jc.segment_type, 'customer'),
       jml.twilio_message_sid, jml.template_id, 'failed',
       COALESCE(jml.sent_at, now())
FROM public.journey_message_log jml
LEFT JOIN public.journey_contacts jc ON jc.id = jml.contact_id
WHERE jml.twilio_message_sid IS NOT NULL
  AND (jml.delivery_status = 'failed' OR jml.status IN ('failed','undelivered'))
ON CONFLICT (whatsapp_message_sid, event_type) DO NOTHING;