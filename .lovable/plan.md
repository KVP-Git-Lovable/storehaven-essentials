

## Fix: Journey schedules never trigger runs

### Root cause

The Journey schedule UI writes correctly to `journey_schedules` (your "Testing for 8L Purchases" row has `frequency=daily`, `execution_time=13:00:00 IST`, `next_run_at=2026-04-23 07:30:00 UTC` = today 1:00 PM IST), and the cron job `journeys-tick` correctly calls `process-journeys` every minute. But **no code in the project ever reads `journey_schedules`**.

`process-journeys` only iterates `journey_enrollments` whose `next_action_at` has passed — i.e., contacts that someone *already enrolled*. Enrollment only happens when a user clicks **Activate** (in `journey-actions/activate`). After every contact has run through the canvas once, the journey is effectively dormant. The schedule is a database row with no executor.

That's why your 1:00 PM IST run produced nothing in Analytics: at 1:00 PM IST the cron fired, `process-journeys` looked at `journey_enrollments` for this journey, saw all rows already `status=completed`, and exited. It never re-enrolled the audience.

The 3 enrollments visible today at 04:43 UTC (10:13 IST) came from a manual Activate, not from the schedule.

### Fix

Teach `process-journeys` to also act as the **scheduler**: at the top of each tick, find every active journey whose `journey_schedules.next_run_at <= now()`, re-enroll its audience (same logic as `journey-actions/activate`), then advance `next_run_at` to the next occurrence using the existing `computeNextRun` rules.

#### Changes in `supabase/functions/process-journeys/index.ts`

1. **New "schedule sweep" block** that runs before the existing enrollment processing loop:
   - Query `journey_schedules` joined to `journeys`, filter:
     - `journeys.status = 'active'`
     - `journeys.approval_status = 'approved'` (skip drafts/pending)
     - `journey_schedules.next_run_at <= now()`
   - For each due schedule, **claim it atomically** by updating `next_run_at` to a temporary far-future value (or a new "running" sentinel) before doing work — this avoids a second cron tick double-enrolling if work overlaps a minute boundary.
   - Resolve the audience using the same code path as `journey-actions`:
     - If `journey.list_view_id` set → call the existing list-view resolver (extract the helper from `journey-actions/index.ts` into a shared module so both functions use it; or inline the same SQL/RPC call).
     - Else → query `journey_contacts` with `segment_type` / `filters.city`.
   - Delete the prior `active`/`paused`/`failed` enrollments for this journey (matches Activate behavior so dynamic audiences refresh).
   - Insert new `journey_enrollments` rows pointing at the canvas entry node with `next_action_at = now()` so the same tick's main loop processes them immediately.
   - Compute the next IST-aware `next_run_at` using the existing `computeNextRun` from `src/lib/journeySchedule.ts` (port it into a shared Deno-compatible helper under `supabase/functions/_shared/journeySchedule.ts` — pure functions, no React imports). Update `journey_schedules.next_run_at` to that value.
   - For `type='one_time'` schedules whose date has passed, set `next_run_at = NULL` (don't re-fire).

2. **Audit log entry** (optional but cheap): write a row to `journey_message_log` or a new lightweight `journey_run_log` so the next time a schedule misses, the user can see it in Analytics. Simplest path: insert one row per scheduled run with `status='enrolled'`, `template_body` = `JSON.stringify({ matched, schedule_id })`. Keeps Analytics non-empty even when audience is empty.

3. **Empty-audience handling**: if the audience resolves to 0 contacts, still advance `next_run_at` and log "no contacts matched at HH:MM" — so users immediately understand why no message went out instead of seeing silence.

#### Shared scheduling helper

Create `supabase/functions/_shared/journey-schedule.ts` containing Deno-friendly copies of:
- `computeNextRun(schedule, fromDate)` — same IST math as `src/lib/journeySchedule.ts`.
- `resolveAudience(supabase, journey)` — extracted from `journey-actions` so both Activate and the scheduler use one source of truth (avoids drift like the variable-resolution bug we already fixed).

#### Backfill the missed run

After deploy, the 1:00 PM IST run today is already in the past. Manually nudge `journey_schedules.next_run_at` for `869cf03d-...` to a near-future timestamp (e.g. `now() + 2 minutes`) so the user can see one successful scheduled execution, then leave the schedule to take over for tomorrow's 1:00 PM IST.

This requires an admin-approved migration since it's a write — confirm with the user whether to also nudge it now or just wait for tomorrow's tick.

### Why Activate still works today

`journey-actions/activate` enrolls contacts and stamps `journeys.status='active'`. The cron-driven `process-journeys` then walks the enrolled rows through the canvas — message nodes call `whatsapp-send`, decision nodes branch, exit nodes mark complete. That part is fine and not changing. We're only adding the missing front-end of the pipeline: turning a schedule tick into fresh enrollments.

### Files to change

- `supabase/functions/process-journeys/index.ts` — add the schedule-sweep block, share helpers.
- `supabase/functions/_shared/journey-schedule.ts` *(new)* — `computeNextRun` (Deno port) + `resolveAudience` extracted from `journey-actions`.
- `supabase/functions/journey-actions/index.ts` — switch its activate path to import the shared `resolveAudience` so behavior stays identical to the scheduler.

No DB migration needed for the fix itself. The cron job, the `journey_schedules` table, RLS, and the existing edge functions are already in place. Optionally one ad-hoc UPDATE to backfill `next_run_at` so today's run isn't lost.

### Validation after deploy

1. Confirm cron call: in edge logs for `process-journeys`, look for new log line `scheduled_runs_triggered: N`.
2. Confirm new enrollments appear at the next IST tick for "Testing for 8L Purchases" (timestamps around 13:00 IST tomorrow, or right after the manual `next_run_at` nudge).
3. Confirm `whatsapp-send` is called → `journey_message_log` rows appear with `status='queued'/'sent'`.
4. Confirm `journey_schedules.next_run_at` advances to the next valid IST occurrence.

