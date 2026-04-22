-- Sync the highvalue_8lakh template to its real Twilio approved/media state
UPDATE public.whatsapp_templates
SET status = 'approved',
    user_initiated_approved = true,
    rejection_reason = NULL
WHERE twilio_content_sid = 'HX807de5f45cf0e60b26d89cb5d3617142';

-- Reset both enrollments back to the Message node so they retry now that the template is approved
UPDATE public.journey_enrollments
SET status = 'active',
    current_node_id = 'node_1776835617711_1',
    next_action_at = now()
WHERE journey_id = '9a60c8b6-0bd2-4ec6-9531-5fdbbc0792f9';

-- Clear the stale failure log entries — we will retry cleanly
DELETE FROM public.journey_message_log
WHERE journey_id = '9a60c8b6-0bd2-4ec6-9531-5fdbbc0792f9'
  AND status = 'failed';