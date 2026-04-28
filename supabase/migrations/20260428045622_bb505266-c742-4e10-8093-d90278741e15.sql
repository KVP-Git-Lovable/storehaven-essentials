CREATE INDEX IF NOT EXISTS idx_journey_enrollments_active_due
  ON public.journey_enrollments (journey_id, status, next_action_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_journey_message_log_enrollment_node_channel
  ON public.journey_message_log (enrollment_id, node_id, channel);

CREATE INDEX IF NOT EXISTS idx_journey_contacts_phone
  ON public.journey_contacts (phone);

ALTER TABLE public.journey_enrollments
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;