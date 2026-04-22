

## Inline expandable date details in Communication Calendar

Enhance `src/pages/communication/CommunicationCalendar.tsx` so clicking any date cell expands a full-width panel directly beneath that week row, showing per-journey details for that day. Existing month grid, filters, schedule expansion, and chip rendering stay untouched.

### UI behavior

- Clicking a date cell sets it as the selected day. Clicking it again (or another cell in the same week) collapses/replaces the selection.
- Only one day expanded at a time.
- Expanded panel is rendered as its own grid item with `col-span-7` immediately after the week row (rows 1–6) that contains the selected date — no modals, no navigation.
- Selected cell gets a stronger ring + subtle bg to make the active selection obvious.
- Smooth expand/collapse via `Collapsible` from `@/components/ui/collapsible` (already in project).
- Mobile (≤640px): panel cards stack vertically; chips wrap; thumbnail shrinks to 64×64.

### Panel content (per journey, as a Card)

For each journey scheduled on the selected IST day:
- **Journey name** (clickable → `/communication/journeys/:id`)
- **Channel** badge (WhatsApp / Email / SMS / Voice — reuses `CHANNEL_STYLES`)
- **Scheduled time** (IST, 12-hour) — from the in-memory expanded events
- **Last run at** — most recent `sent_at` from `journey_message_log` for that journey
- **Execution status** — derived from latest log row:
  - `delivered` / `read` → green "Completed"
  - `queued` / `pending_delivery` / `sent` → amber "Pending"
  - `failed` / `undelivered` → red "Failed"
  - none yet → muted "Not yet run"
- **Audience count** — count of `journey_enrollments` where `journey_id = X` (all-time enrolled). Shown as "N contacts".
- **Media preview** — if the journey's first message node has a `media_url` / `mediaUrl` / template `twilio_media_url`, render a 96×96 rounded thumbnail (image). If none, hide the section entirely.

### Data fetching (no new API route — uses existing Supabase client)

The user spec mentions `GET /api/journeys/by-date`, but the project doesn't have a REST layer; data already comes from Supabase. We fetch the same shape directly:

- `useQuery` keyed `["calendar-day-details", dayKey, journeyIds]`, enabled only when a date is selected.
- Query runs **once per opened date** and is cached by react-query (satisfies "lazy load + cache previously opened dates"). `staleTime: 5 * 60_000`.
- Inputs: the journey IDs already scheduled for that day (derived from `eventsByDay.get(dayKey)`).
- Two parallel queries scoped to those IDs:
  1. `journey_message_log`: `select('journey_id, sent_at, status, delivery_status').in('journey_id', ids).order('sent_at', { ascending: false })` — reduce client-side to latest per journey.
  2. `journey_enrollments`: `select('journey_id', { count: 'exact', head: false }).in('journey_id', ids)` — group client-side for audience count.
- Media URL resolved from `canvas_data` (already loaded) — no extra fetch.

### Implementation outline

1. Add state: `selectedDayKey: string | null`.
2. In the 42-cell grid loop, make each cell a `<button>` with `onClick={() => setSelectedDayKey(prev => prev === cell.key ? null : cell.key)}`. Preserve existing chip click handlers via `e.stopPropagation()` (already used for chips).
3. After every 7 cells (week row), if `selectedDayKey`'s cell falls within that week, render `<div className="col-span-7">…panel…</div>` so it appears under the correct row.
4. New child component `CalendarDayDetails` ({ dayKey, events }): runs the react-query call, renders skeletons → cards → empty state.
5. New helper `getJourneyMediaUrl(canvas_data)` mirrors the existing `deriveFirstMessagePreview` pattern.

### Files to change

- `src/pages/communication/CommunicationCalendar.tsx` — add selection state, week-row injection, render `<CalendarDayDetails>` panel.
- `src/components/communication/CalendarDayDetails.tsx` (new) — encapsulates the per-day panel with its own `useQuery` for logs + audience count.

### Constraints respected

- Existing calendar layout, filters, schedule expansion, chip rendering, and IST handling are unchanged.
- No DB migration. No edge function. No new route.
- Mobile-friendly (stacked cards, wrapping chips, 16px input font rules untouched).
- Status colors: green / amber / red as specified.

