-- Add node_id to journey_message_log for idempotency tracking
ALTER TABLE public.journey_message_log
  ADD COLUMN IF NOT EXISTS node_id text,
  ADD COLUMN IF NOT EXISTS twilio_message_sid text,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Unique index to prevent duplicate sends per (enrollment, node)
CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_message_log_enrollment_node
  ON public.journey_message_log (enrollment_id, node_id)
  WHERE enrollment_id IS NOT NULL AND node_id IS NOT NULL;

-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;