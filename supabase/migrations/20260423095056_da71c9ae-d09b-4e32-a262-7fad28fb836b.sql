
-- Add SMS sender number to whatsapp_config (reused for journey channel sends)
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS sms_sender_number text;

-- Replace the (enrollment_id, node_id) idempotency index with one that
-- includes channel, so per-channel free-form sends each get their own row.
DROP INDEX IF EXISTS public.uq_journey_message_log_enrollment_node;

CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_message_log_enrollment_node_channel
  ON public.journey_message_log (enrollment_id, node_id, channel)
  WHERE enrollment_id IS NOT NULL AND node_id IS NOT NULL;
