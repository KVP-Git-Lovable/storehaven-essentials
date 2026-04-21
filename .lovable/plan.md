

## Communication Calendar

Add a new "Calendar" submenu under Communication Center that visualises all upcoming scheduled communications (WhatsApp, Email, SMS, Voice) on a month-grid, sourced from active journeys + their `journey_schedules`.

### 1. Sidebar & Route

- **Edit `src/components/layout/AppSidebar.tsx`** — under the existing `Communication Center` group, append one new child (additive only, no reordering, no other menus changed):
  ```ts
  { title: "Calendar", href: "/communication/calendar", moduleKey: "communication.journeys" },
  ```
  Reuses the existing `communication.journeys` permission so no new RBAC entry is needed.

- **Edit `src/App.tsx`** — register the new lazy route inside the existing protected group:
  ```ts
  const CommunicationCalendar = lazy(() => import("./pages/communication/CommunicationCalendar"));
  <Route path="/communication/calendar" element={<CommunicationCalendar />} />
  ```

### 2. New Page — `src/pages/communication/CommunicationCalendar.tsx`

A single-file page using existing UI primitives (`Card`, `Button`, `MultiSelectCombobox`, `Tooltip`, `Badge`, `cn`) — no new colors, no new dependencies.

**Header bar (sticky top of the page):**
- Title "Communication Calendar" with muted subtitle "Upcoming scheduled communications across all active journeys".
- Month label (e.g. "April 2026") + `‹` Prev / `Today` / `Next ›` buttons.
- `MultiSelectCombobox` for **Channel** (WhatsApp, Email, SMS, Voice).
- "Showing X events" counter on the right.

**Data fetching (single React Query):**
```ts
supabase
  .from("journeys")
  .select("id, name, status, canvas_data, schedule:journey_schedules(*)")
  .eq("status", "active")
```
Only `status = 'active'` journeys are considered (matches the requirement "Active Journeys" + "Exclude Completed/Failed").

**Event derivation (client-side, pure):**
- For each journey, extract channels by walking `canvas_data.nodes` for `type === 'message'` and reading `node.data.channel` (same logic already used in `JourneyList`'s `deriveJourneyMeta` — duplicated locally so JourneyList is untouched).
- For each journey with a `schedule`, call `expandToCalendarEvents(schedule, monthStart, monthEnd, journey.name)` from the existing `src/lib/journeySchedule.ts`.
- Fan-out one event per channel (a journey with both WhatsApp + Email yields two events at the same timestamp).
- Filter out events whose timestamp is in the past (`event.start <= now`) — keeps the view "scheduled (future) only".
- Apply the channel multi-select filter.

**Month grid:**
- Compute the 6-week grid starting on the Sunday on/before the 1st of the visible month.
- Render a CSS grid `grid-cols-7`, header row `Sun…Sat`, then 42 day cells.
- Each day cell:
  - Top-right: date number; muted/`opacity-50` when outside current month; `bg-accent` ring when it is today.
  - Below: stacked event chips (max 3 visible, then `+N more` opens a `Popover` with the full list).
  - Each chip shows: channel icon (`MessageSquare` for WhatsApp, `Mail` for Email, `Phone` for SMS/Voice — all already imported elsewhere), `HH:MM` IST, and journey name (truncated). `Tooltip` on hover shows full journey name + IST date/time + (if available) the first message node's preview text.
  - Clicking a chip navigates to `/communication/journeys/:id` (existing route, no changes).

**Channel color tags (existing palette only — no new tokens):**
- WhatsApp → `bg-green-100 text-green-800` (already used in `JourneyList` status badges).
- Email → `bg-blue-100 text-blue-800` (already used elsewhere).
- SMS → `bg-amber-100 text-amber-800`.
- Voice → `bg-purple-100 text-purple-800`.

These shades already appear in the codebase — no new theme entries.

**Empty / loading states:**
- Skeleton grid while loading.
- "No scheduled communications this month" muted text below the grid when filtered result is empty.

### 3. Time handling

All times remain IST. Reuses `formatIst()` and `expandToCalendarEvents()` from `src/lib/journeySchedule.ts` — no changes to that file. Day-cell bucketing converts each event's UTC `Date` to IST date parts (using the same `+05:30` arithmetic already in that module via a small local helper).

### 4. Backend / DB

**No DB migrations, no edge functions, no new RLS policies, no new tables.** The existing `journeys` + `journey_schedules` tables already provide everything needed; the spec's `GET /api/v1/communications/calendar` is satisfied client-side by the existing typed Supabase query (consistent with how `JourneyList` operates).

### 5. Constraints honored

- Existing Communication Center menus, pages, and workflows untouched.
- No theme/color changes — only Tailwind classes already used in the codebase.
- No data is altered or deleted.
- New page is permission-gated by the existing `communication.journeys` module key.

### Files

- **New:** `src/pages/communication/CommunicationCalendar.tsx`
- **Edit:** `src/components/layout/AppSidebar.tsx` — add one Calendar entry to the Communication Center children.
- **Edit:** `src/App.tsx` — add lazy import + one `<Route path="/communication/calendar" />`.

No other files modified.

