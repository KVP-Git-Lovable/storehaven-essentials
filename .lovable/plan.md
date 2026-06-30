# Why the count is the same for "within 1 hour" and "within 3 days"

The current Audience Preview logic in `src/components/journey/MessageResponseAudiencePreviewDialog.tsx` only checks the **current status** of each sent message (e.g. is `status` or `delivery_status` equal to `read`?). It does **not** look at *when* the read event actually arrived.

So the window value (1 hour vs 3 days) has no effect for `read` / `delivered` / `failed` / `undelivered` — every contact whose message is currently marked Read counts as a match, regardless of how long after the send the read actually happened. That is why 1 hour and 3 days both return 329.

Only the `replied` condition currently respects the time window, because that path joins on `whatsapp_messages.created_at` and compares it to the send time.

# Fix

Use the per-event timestamps already stored in `journey_message_events` (populated by `whatsapp-inbound` whenever Twilio reports `sent`, `delivered`, `read`, `failed`, `undelivered`). Each row has `whatsapp_message_sid`, `event_type`, and `event_timestamp`.

### Changes in `MessageResponseAudiencePreviewDialog.tsx`

1. After fetching the `journey_message_log` rows for the node, collect every non-null `twilio_message_sid`.
2. Fetch all matching `journey_message_events` rows (paginated) for that journey and those SIDs, selecting `whatsapp_message_sid, event_type, event_timestamp`. Build a map: `sid -> { delivered?: ts, read?: ts, failed?: ts, undelivered?: ts }` (keep the earliest timestamp per event_type).
3. Replace `reachedStatus(row, baseCond)` with a timestamp-aware check:
   - For `baseCond === 'read'`: matched if `events[sid].read` exists AND `read_ts - sent_at <= windowMs`.
   - For `baseCond === 'delivered'`: matched if (`events[sid].delivered` OR `events[sid].read`) within the window. (Read implies delivered.)
   - For `baseCond === 'failed'` / `'undelivered'`: same pattern using the corresponding event timestamp; fall back to row status only if no event row exists (legacy data without events).
4. Negative conditions (`not_read`, `not_delivered`, …) keep the existing rule: window must be closed AND the positive condition was NOT met within the window.
5. `replied` / `not_replied` logic stays unchanged — it already uses timestamps.
6. The dedupe-by-`contact_id` step stays: prefer a matched row, otherwise keep most recent. With the new evaluation a contact is counted matched only if at least one of their sends had a Read (or chosen) event inside that send's own window.
7. Optional UI nicety: in the matched rows table, show "Read at" (event timestamp) instead of/in addition to "Current Status" so the user can audit the within-window decision.

### Edge cases handled

- Messages with no SID (still queued / failed before send) — skipped for status conditions; never match positive `read`.
- Older messages logged before `journey_message_events` was populated — fall back to current `status` only for `delivered`/`failed`/`undelivered`; for `read` require the event row (otherwise we cannot honor the window and would re-introduce the current bug). Document this in a small comment.
- Multiple `read` webhooks for the same SID — `(whatsapp_message_sid, event_type)` is unique, so at most one row per event per SID.

### Scope

- Frontend only. No edge function, schema, or other workflow changes.
- File touched: `src/components/journey/MessageResponseAudiencePreviewDialog.tsx`.

### Verification

- Open the same node with "within 1 hour" and "within 3 days" — counts should differ (1h ≤ 3d).
- Spot-check one matched contact in View Logs: their Twilio `read` timestamp should be within 1 hour after `sent_at`.
- Reset to "within 30 days" — count should be ≥ the 3-day count and ≤ total contacts whose current status is Read.
