UPDATE public.journey_message_log
SET status = 'failed',
    delivery_status = 'failed',
    error_code = 'stuck_sending',
    error_message = 'Send call did not complete (no Twilio SID returned). Marked as failed so it can be retried from the Rate-limited Failures screen.'
WHERE journey_id = '2f72862f-0b50-4858-a8b2-e23280735f7a'
  AND status = 'sending'
  AND twilio_message_sid IS NULL;