## Goal

Move "Rate-limited Failures" from inline section to a dedicated page (opened via button), add a new "Status code failures" page (opened via button) with tabs for error codes `63049` and `63024`, and ensure the processor does not auto-retry messages that failed with those two codes.

## 1. Journey Analytics header — replace section with buttons

File: `src/pages/communication/JourneyAnalytics.tsx`

- Remove the inline `<RateLimitedRetrySection />` render and its `lazy` import.
- In the header (next to "View Logs"), add two new buttons:
  - **Rate-limited Failures** → navigates to `/communication/journeys/:id/rate-limited-failures`
  - **Status code failures** → navigates to `/communication/journeys/:id/status-code-failures`

## 2. New page: Rate-limited Failures

File: `src/pages/communication/JourneyRateLimitedFailures.tsx` (new)

- Standalone page with back button → Journey Analytics.
- Renders the existing `RateLimitedRetrySection` component unchanged (already supports list + select + Retry selected at 1 msg / 12s).

## 3. New page: Status code failures (with tabs)

File: `src/pages/communication/JourneyStatusCodeFailures.tsx` (new)

- Two tabs: **63049 — Blocked by Meta** and **63024 — Template paused**.
- New shared component `src/components/journey/StatusCodeFailuresTable.tsx` parameterised by `errorCode` that:
  - Paginates `journey_message_log` filtered by `journey_id`, `status = 'failed'`, `error_code = <code>`.
  - Dedupes by phone (last-10), like the rate-limit table.
  - Excludes contacts who later had any successful send in this journey (same logic as `RateLimitedRetrySection`).
  - Shows Contact, Phone, Failed at, Twilio error message, Retry status.
  - Header: Refresh + Retry selected (uses the existing `retry-journey-message` edge function, 12s spacing — same loop pattern reused).

## 4. Suppress automatic retries for 63049 / 63024

File: `supabase/functions/process-journeys/index.ts` (around lines 1118–1146 — the per-enrollment retry/backoff branch)

- After computing `anyAccepted`, before the existing retry/backoff branch:
  - If any `sendResults` entry has `errorCode === "63049"` or `"63024"`, update the enrollment to `status = 'failed'` immediately and skip the retry/backoff increment. Do not delete the failed `journey_message_log` row (so it shows up in the new page).
- Result: these messages will only be re-sent when the user explicitly clicks **Retry selected** on the Status code failures page.

The existing `retry-journey-message` edge function already handles manual one-off retries, so no backend changes are needed there.

## 5. Routing

File: `src/App.tsx`

Add two protected routes inside the communication area:

```text
/communication/journeys/:id/rate-limited-failures  → JourneyRateLimitedFailures
/communication/journeys/:id/status-code-failures   → JourneyStatusCodeFailures
```

## Files touched

- `src/pages/communication/JourneyAnalytics.tsx` — remove inline section, add two header buttons.
- `src/pages/communication/JourneyRateLimitedFailures.tsx` — new page wrapper.
- `src/pages/communication/JourneyStatusCodeFailures.tsx` — new page with tabs.
- `src/components/journey/StatusCodeFailuresTable.tsx` — new reusable table + retry.
- `src/App.tsx` — two new routes.
- `supabase/functions/process-journeys/index.ts` — skip auto-retry on 63049/63024.

## Notes

- No DB schema change required — `error_code` column already exists on `journey_message_log`.
- The existing `RateLimitedRetrySection` component is reused as-is on its new page; the manual retry pipeline (`retry-journey-message`, 12s spacing, analytics invalidation) is shared by the new Status code failures page.