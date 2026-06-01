# Journey Analytics — Read Status

## Root cause of "Read = 0"

Twilio is correctly sending WhatsApp read receipts and the webhook is correctly receiving them:

- `whatsapp-send` sets `StatusCallback=…/whatsapp-inbound?event=status`
- `journey_message_log` already has rows with `status='read'` (1 row today)
- Webhook also tries to insert into `journey_message_events`

The real bug: **`journey_message_events` is empty** (0 rows for any event type). All current journey sends happened *before* the engagement-tracking code was deployed, so no `sent` rows exist — and the read upsert in the webhook ran but matched no prior context that the analytics UI cares about (and the UI was reading exclusively from `journey_message_events`).

So the analytics summary said "Read = 0" because it was sourcing reads from an empty events table, while the actual read state lives on `journey_message_log.status`.

### Fix strategy

Source the per-message **Read / Delivered / Failed** state directly from `journey_message_log.status` (the canonical, already-populated field updated by the webhook). Continue to feed `journey_message_events` for the engagement-scoring engine, but stop making the analytics UI depend on it being backfilled.

Also add a small one-time backfill so historical rows show up in engagement metrics.

## Part 1 — Recent Messages table: add Read column

`src/pages/communication/JourneyAnalytics.tsx`

- Add a `Read Status` column between `Status` and `Link Status`.
- Per row, derive from `m.status` / `m.delivery_status`:
  - `read` → green "Read" badge
  - `delivered` (and not read) → muted "Not Read"
  - `sent` / `queued` / `accepted` / `scheduled` / `sending` → "Pending"
  - `failed` / `undelivered` → destructive "Failed"
- Column visible for WhatsApp messages only; show "—" for SMS/email rows.

## Part 2 — Summary cards: add Read

`src/pages/communication/JourneyAnalytics.tsx` and `src/components/journey/JourneyEngagementSummary.tsx`

- Add a "Read" tile alongside Sent / Delivered / Clicked.
- Source for the top "Live Send Progress" + main metric cards: count rows in `journey_message_log` for this journey where `status='read'` (reliable, no event-log dependency).
- `JourneyEngagementSummary` already pulls from `journey_message_events`; extend it to also query `journey_message_log` so the Read tile is accurate even for historical sends. Click count continues to come from `journey_message_events.event_type='clicked'` (unchanged). Read is **not** inferred from clicks.

## Part 3 — Webhook diagnostics & event integrity (small, safe)

`supabase/functions/whatsapp-inbound/index.ts`

- Add structured log at status-callback entry:
  `console.log("[wa-status]", { messageSid, status, errorCode, matchedJmlRows: jmlRows?.length ?? 0 })`
- If `jmlRows.length === 0` for a known status, log a warning with the SID so SID-mapping issues are visible in edge logs.
- No behavioural change to TwiML, sending, or enrollment advancement.

## Part 4 — Backfill migration (one-time)

New migration to seed `journey_message_events` from existing `journey_message_log` so engagement scoring isn't blind to history:

- Insert `sent` events for every `journey_message_log` row with a non-null `twilio_message_sid` (idempotent via existing unique `(whatsapp_message_sid, event_type)` index).
- Insert `delivered` events for rows with `delivery_status='delivered'` or `status IN ('delivered','read')`.
- Insert `read` events for rows with `status='read'`.
- Insert `failed` events for rows with `delivery_status='failed'` or `status IN ('failed','undelivered')`.
- All inserts use `ON CONFLICT DO NOTHING`. The existing `apply_engagement_event` trigger will roll scores into `person_engagement_scores` automatically.

## Out of scope (unchanged)

- Twilio sending logic, `whatsapp-send`, `process-journeys` send path, templates, scoring formula, link tracking, journey execution, scheduler.

## Files touched

- `src/pages/communication/JourneyAnalytics.tsx` — Read column + Read tile
- `src/components/journey/JourneyEngagementSummary.tsx` — Read tile sourced from `journey_message_log`
- `src/hooks/useJourneyEngagement.ts` — additional query for read counts
- `supabase/functions/whatsapp-inbound/index.ts` — diagnostic logs only
- New migration — backfill `journey_message_events` from `journey_message_log`
