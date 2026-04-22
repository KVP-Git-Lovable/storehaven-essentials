DELETE FROM public.journey_message_log
WHERE journey_id = '9a60c8b6-0bd2-4ec6-9531-5fdbbc0792f9'
  AND status IN ('failed', 'sending');

UPDATE public.journey_enrollments
SET status = 'active',
    current_node_id = 'node_1776835617711_1',
    next_action_at = now()
WHERE journey_id = '9a60c8b6-0bd2-4ec6-9531-5fdbbc0792f9';