## Problem

After clicking **Activate** in Journey Builder, WhatsApp messages arrive 5–6 minutes later. Two compounding causes:

1. **Activation does not send.** `journey-actions/activate` only inserts `journey_enrollments` rows. Actual sending happens later when the `process-journeys` cron tick runs (every ~60s based on logs).
2. **The processor is fully sequential.** Inside `process-journeys`, for each active journey, every enrollment is awaited one-at-a-time — including a full HTTP round-trip to the `whatsapp-send` edge function (which itself calls Twilio). With N recipients you pay N × (~1–3s) inside one cron tick, often spilling into the next tick.

There are no DB indexes on the hot lookup paths (`journey_enrollments(journey_id, status, next_action_at)` and `journey_message_log(enrollment_id, node_id, channel)`).

## Fix Strategy

Keep the existing architecture (cron + `journey_enrollments` as the queue — that **is** the message queue), but:

- Trigger processing **immediately on Activate** (don't wait for cron).
- Process enrollments in **parallel batches** (default 20) inside `process-journeys`.
- Add **DB indexes** on the hot paths.
- Surface **progress** (sent / pending / failed) on the journey detail page.
- Keep cron as the safety net + retry mechanism.

Activation stays fire-and-forget from the user's perspective: the client gets the enrollment count immediately; sending happens in the background invocation.

## Changes

### 1. `supabase/functions/journey-actions/index.ts` — kick off processing on Activate
After inserting enrollments and flipping status to `active`, fire a non-blocking invocation of `process-journeys` scoped to this journey:

```ts
// Fire-and-forget — don't await; respond to client immediately
supabase.functions.invoke("process-journeys", {
  body: { journey_id: journey_id, trigger: "activation" },
}).catch((e) => console.error("[activate] kickoff failed", e));
```

Return the same response shape as today (`enrolled`, `matched`, `skipped`).

### 2. `supabase/functions/process-journeys/index.ts` — parallel batched execution + targeted run
- Accept optional `{ journey_id }` in the request body. If present, restrict the active-journeys query to that ID and skip the schedule sweep (faster path for activation kickoffs).
- Replace the inner sequential `for (const enrollment of enrollments)` with batched parallel execution:

```ts
const BATCH_SIZE = 20;
for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
  const batch = enrollments.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map((e) => processEnrollment(e, journey, canvas, ctx)));
}
```

- Extract the current per-enrollment body into an `async processEnrollment(...)` function. **No behavioural change** to the message/delay/exit/template/freeform branches — only restructured into a function so it can run concurrently.
- Wrap each call in try/catch so one failure cannot abort the batch.
- Keep the existing **idempotency guard** (the `journey_message_log` insert with the unique `(enrollment_id, node_id, channel)` claim) — this is what makes parallel safe and prevents duplicate sends if the cron and the activation kickoff overlap.
- Add a small concurrency cap per journey (BATCH_SIZE=20) to respect Twilio rate limits.

### 3. DB indexes (migration)
```sql
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_active_due
  ON public.journey_enrollments (journey_id, status, next_action_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_journey_message_log_enrollment_node_channel
  ON public.journey_message_log (enrollment_id, node_id, channel);

CREATE INDEX IF NOT EXISTS idx_journey_contacts_phone
  ON public.journey_contacts (phone);
```

### 4. Progress tracking — `JourneyAnalytics.tsx` (small addition)
Add a "Live progress" card at the top of the existing analytics page showing for the current journey:
- **Total enrolled** = count of `journey_enrollments` for this journey
- **Sent** = count of `journey_message_log` with `status in ('sent','queued','accepted','delivered')`
- **Pending** = enrolled − sent − failed
- **Failed** = `journey_message_log` with `status = 'failed'`

Auto-refresh every 5s via `useQuery({ refetchInterval: 5000 })` while the journey is `active`.

Also add a subtle toast on Activate: *"Journey activated — N contacts enrolled. Sending in the background…"* (the existing toast already says this; just make sure the kickoff is mentioned).

### 5. Retry (lightweight, no schema change)
Failed sends today set `journey_enrollments.status = 'failed'`, which means cron skips them forever. Update the failure branch to set `status = 'active'` with `next_action_at = now() + 5 minutes` and a new `retry_count` column (added in the migration, default 0). Cap at 3 retries — after that, mark `failed` permanently.

```sql
ALTER TABLE public.journey_enrollments
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
```

## Out of Scope (intentionally)

- **No new `message_queue` table.** `journey_enrollments` already serves this role with idempotent claim semantics. Adding another table would duplicate state and create sync bugs.
- **No "audience snapshot" table.** The current `journey_enrollments` insert at activation time *is* the snapshot — execution reads enrolled contacts, not the live list view. Already correct.
- **No changes to `whatsapp-send` itself** — it's already a thin Twilio wrapper.

## Expected Result

| Recipients | Before | After |
|------------|--------|-------|
| 1          | 5–6 min (waiting for cron) | < 3s |
| 20         | 5–7 min | < 5s |
| 200        | 10+ min, spans multiple ticks | ~30s (10 batches × ~3s) |

## Files Touched

- `supabase/functions/journey-actions/index.ts` — fire-and-forget kickoff in `activate`
- `supabase/functions/process-journeys/index.ts` — accept `journey_id`, parallel batches, retry-on-failure
- `src/pages/communication/JourneyAnalytics.tsx` — live progress card with 5s refetch
- New migration — 3 indexes + `retry_count` column
