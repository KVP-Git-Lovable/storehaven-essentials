# WhatsApp Engagement Scoring — Phase 1

Lightweight scoring layer on top of existing Journey Builder WhatsApp sends. **No changes** to Twilio sending, journey execution, templates, or message flow — only additive event capture, scoring, and analytics display.

## Scope

Only WhatsApp messages sent through Journey Builder. Events tracked: `sent`, `delivered`, `read`, `clicked`.

Excluded (future phases): sentiment, STOP/opt-out, AI intent, channel-wise scoring, email/SMS scoring, filtering UI.

## 1. Database (migration)

### `journey_message_events` — audit log

- `id`, `journey_id`, `journey_step_id` (nullable), `person_id` (uuid, nullable), `entity_type` (text: `customer|lead|visitor`), `whatsapp_message_sid` (text), `template_id` (uuid, nullable), `event_type` (text: `sent|delivered|read|clicked`), `event_timestamp` (timestamptz), `metadata_json` (jsonb), `created_at`
- Indexes on `(journey_id)`, `(person_id, entity_type)`, `(whatsapp_message_sid)`, `(event_type)`
- Unique on `(whatsapp_message_sid, event_type)` to make webhook retries idempotent (clicked excluded — multiple clicks allowed)
- RLS: authenticated read; service_role write (events written only by edge functions)

### `person_engagement_scores` — cumulative

- `id`, `person_id`, `entity_type`, `whatsapp_score` (int, default 0), `total_messages_sent`, `total_delivered`, `total_read`, `total_clicked`, `total_failed` (all int default 0), `last_engagement_at`, `created_at`, `updated_at`
- Unique on `(person_id, entity_type)`
- RLS: authenticated read; service_role write

### `whatsapp_tracked_links` — per-message link tokens

- `id`, `token` (text, unique, short random), `journey_id`, `journey_step_id`, `person_id`, `entity_type`, `template_id`, `original_url` (text), `whatsapp_message_sid` (nullable), `created_at`
- Index on `token`
- RLS: service_role only (resolved by edge function)

### Scoring function

`apply_engagement_event(_person_id, _entity_type, _event_type, _at)` — security definer. Upserts row in `person_engagement_scores`, increments matching counter and `whatsapp_score` by `{sent:+1, delivered:+2, read:+5, clicked:+10}`, updates `last_engagement_at`. Called from trigger on `journey_message_events` insert.

Trigger `journey_message_events_score_trg` AFTER INSERT calls the function. Keeps scoring async-from-sender's perspective (sender just inserts the event).

## 2. Event capture (edge functions)

### `whatsapp-inbound` (status webhook) — additive only

Currently updates `journey_message_log.delivery_status`. Add: when status is `sent|delivered|read|undelivered`, look up the `journey_message_log` row by SID to get `journey_id`/`contact_id`, resolve `(person_id, entity_type)` from `journey_contacts`, and insert into `journey_message_events`. Wrapped in try/catch — failure must NOT break existing webhook handling.

`undelivered` maps to event_type `failed`. Idempotent via unique constraint.

### `process-journeys` / wherever the send happens

On successful Twilio accept (already logged to `journey_message_log` with sid), insert a `sent` event into `journey_message_events`. Single line addition, fire-and-forget.

## 3. Tracked link rewriting

### New edge function: `track-engagement-click`

- `GET /track-engagement-click?t={token}` → look up token, insert `clicked` event, 302 redirect to `original_url`. No auth required (public).
- Verifies token exists; on missing token redirects to a safe fallback (homepage) and logs.

### Link wrapping (in `process-journeys` before sending template)

Before substituting URL variables into a template body for a recipient:

1. Scan resolved variable values for `http(s)://...` URLs.
2. For each, create a `whatsapp_tracked_links` row with short token (e.g. nanoid 10 chars).
3. Replace the URL with `https://{project}.functions.supabase.co/track-engagement-click?t={token}` (or custom domain if configured later).
4. Send the rewritten body to Twilio as usual.

Done only for journey sends; freeform/template-direct sends untouched. Tracked link table holds the mapping so we know which person clicked.

Note: existing `track-link-click` function (hardcoded SID, server-side attribution by phone) remains untouched — it serves the older specific-template flow. New function is the generic tokenized one.

## 4. Journey Analytics UI

In `src/pages/communication/JourneyAnalytics.tsx`, add new lazy section `<EngagementSummary journeyId={id} />`:

**Engagement Summary card**

- Counts: Sent / Delivered / Read / Clicked / Failed (from `journey_message_events` aggregated by event_type for this journey)
- Average Engagement Score: average `whatsapp_score` across distinct recipients of this journey

**Top Engaged Recipients table**

- Top 10 by score among recipients of this journey
- Cols: Name (from `journey_contacts`), Entity Type, Score, Delivered %, Read %, Click %
- Percentages = count(event) / count(sent) per person for this journey

New hook `useJourneyEngagement(journeyId)` does both queries with TanStack Query, 30s refetch while journey active.

## 5. Optional person badge

Small `<EngagementBadge personId entityType />` component — fetches score and shows `WhatsApp Engagement: N`. Add to customer/lead detail pages only if quick to slot in; otherwise defer to Phase 2.

## 6. Performance notes

- All scoring via trigger on insert — sender code adds only one INSERT per event.
- Indexes cover the analytics aggregation paths.
- Tracked-link rewrite is O(URLs per message), negligible.
- Score table is one row per (person, entity), bounded by audience size.

## Non-goals / unchanged code

- `whatsapp-send`, `whatsapp-send-freeform`, `whatsapp-templates`, `whatsapp-config`, `journey-actions`, Twilio API calls, template approval, scheduler, wallet APIs, journey enrollment logic, existing `JourneyCostAnalytics`, existing `track-link-click`, existing `whatsapp_link_clicks` table.

## Deliverables

1. One migration: 3 tables + grants + RLS + scoring function + trigger.
2. Edge function `track-engagement-click`.
3. Edits: `whatsapp-inbound` (event insert on status), `process-journeys` (sent-event insert + link rewriting).
4. New hook `useJourneyEngagement.ts` + component `JourneyEngagementSummary.tsx`.
5. `JourneyAnalytics.tsx` mounts the new section.

Confirm and I'll implement.