# Journey Analytics – View Logs

Add a **View Logs** button next to **Export** on the Journey Analytics page. Clicking it opens a full-screen dialog that lists every message sent for this journey with Twilio-aligned columns.

## UI

- New outlined button **View Logs** (file-text icon) placed left of **Export** in the page header of `src/pages/communication/JourneyAnalytics.tsx`.
- Opens a large `Dialog` (max-w-7xl, 90vh) containing:
  - Header: title, total count, search box (name / phone / SID), status filter dropdown, CSV export of the filtered rows.
  - Scrollable table with columns:
    1. **Username** – contact name from `journey_contacts` / `customers` / `leads`
    2. **Phone** – E.164 formatted
    3. **Message** – truncated body with hover/expand
    4. **Status** – badge (Sent, Delivered, Read, Clicked, Failed, Undelivered, Queued)
    5. **Reason** – Twilio error code + description (only for failed / undelivered)
    6. **Sent At** – `MMM d, yyyy HH:mm`
    7. **SID** – Twilio Message SID (monospace, copy on click)
  - Empty / loading states; pagination past Supabase's 1000-row cap using the existing `fetchAllPaged` pattern.

## Data

Build a new hook `useJourneyMessageLogs(journeyId)`:

- Pull all `journey_message_log` rows for the journey (paginated).
- For each row, derive:
  - `contact_id` → join `journey_contacts` for `name` / `phone` (batched `.in()` chunks of 200, same as `RateLimitedRetrySection`).
  - `body` from `rendered_body` (fallback to template name).
  - `status` from latest `journey_message_events` row per `message_sid` (delivered/read/clicked beat sent). Use a single paged query filtered by `message_sid in (...)`.
  - `error_code` + `error_message` from the log row; map common Twilio codes (63049 = "Message blocked by Meta - user opted out / number unreachable", 63016 = "Outside 24h window", 21610 = "Recipient unsubscribed", 21620 = "Invalid media URL", etc.) via a small lookup table in `src/lib/twilioErrors.ts`.
- Status badge colors reuse the existing palette from `MessageLog.tsx`; add `read` (blue), `clicked` (violet), `undelivered` (amber).

## Files

- **New** `src/components/journey/JourneyLogsDialog.tsx` – dialog UI, search, filter, CSV export.
- **New** `src/hooks/useJourneyMessageLogs.ts` – fetch + merge + dedupe.
- **New** `src/lib/twilioErrors.ts` – `{ [code]: humanMessage }` lookup.
- **Edit** `src/pages/communication/JourneyAnalytics.tsx` – add button + dialog state.

No backend / edge function / schema changes – everything is read from existing tables.

## Out of scope

- No changes to send pipeline, retry logic, or other analytics sections.
- Reason column is best-effort from stored Twilio error codes; we do not re-fetch live Twilio data.
