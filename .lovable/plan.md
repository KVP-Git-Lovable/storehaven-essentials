

## Journey Scheduling

Add scheduling (one-time + recurring) to journeys, persisted in a new table, editable from the journey list with a human-readable summary and next-run calculation. All times stored/treated as IST (`Asia/Kolkata`).

### 1. Database — new migration

**Table `public.journey_schedules`** (one schedule per journey, enforced by unique constraint):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `journey_id` | uuid FK → `journeys(id)` ON DELETE CASCADE, **UNIQUE** | one active schedule per journey |
| `type` | text | `one_time` \| `recurring` |
| `frequency` | text NULL | `daily` \| `weekly` \| `monthly` \| `quarterly` (null when `type='one_time'`) |
| `execution_date` | date NULL | required when `one_time` |
| `execution_time` | time NULL | HH:MM (IST) — required for all schedules |
| `days_of_week` | int[] NULL | 0=Sun … 6=Sat — required for `weekly` |
| `day_of_month` | int NULL (1–31) | required for `monthly`, `quarterly` |
| `month_of_quarter` | int NULL (1–3) | optional for `quarterly` (1 = first month of each quarter → Jan/Apr/Jul/Oct) |
| `timezone` | text default `'Asia/Kolkata'` | |
| `next_run_at` | timestamptz NULL | computed on insert/update for calendar + scheduler |
| `created_by` | uuid → `profiles(id)` | |
| `created_at` / `updated_at` | timestamptz | trigger updates `updated_at` |

**Validation trigger** (BEFORE INSERT/UPDATE) enforces:
- `one_time` → `execution_date` and `execution_time` not null; `frequency` null.
- `recurring` → `frequency` not null; `execution_time` not null.
- `weekly` → `array_length(days_of_week,1) >= 1`.
- `monthly` / `quarterly` → `day_of_month BETWEEN 1 AND 31`.

**RLS**: enable RLS; policies mirror `journeys` (users with permission on `communication-journeys` can SELECT/INSERT/UPDATE/DELETE their own org records). Read access for hierarchy via existing helpers used elsewhere.

**Indexes**: `journey_id`, `next_run_at`, `(type, frequency)`.

### 2. Frontend — Journey List schedule dialog

**Edit:** `src/pages/communication/JourneyList.tsx`

- New row action **"Schedule"** (Calendar icon) on every journey row, alongside existing Submit / Play / Pause / Analytics / Delete. (Additive — no existing action removed.)
- Status column: small `Badge` showing the human-readable summary if a schedule exists (e.g. *"Every Mon at 5:30 PM IST"*), fed by a joined query.
- Journey list query extended with `schedule:journey_schedules(*)` so the badge and Edit dialog prefill work in one round-trip.

**New component:** `src/components/journey/JourneyScheduleDialog.tsx`

UI inside the dialog:
- **Type** segmented control: *One-time* / *Recurring*.
- **One-time fields**: Date (shadcn `Calendar` inside `Popover`, with `pointer-events-auto`) + Time (`<Input type="time">`).
- **Recurring fields**:
  - Frequency `Select`: Daily / Weekly / Monthly / Quarterly.
  - Daily → Time only.
  - Weekly → 7 toggle chips (Mon…Sun, multi-select) + Time.
  - Monthly → Day of month `Select` (1–31, with hint *"If month has fewer days, runs on last day."*) + Time.
  - Quarterly → "Month within quarter" `Select` (1st / 2nd / 3rd month — auto resolves to Jan-Apr-Jul-Oct etc.) + Day of month + Time.
- **Live summary line** at the bottom (e.g. *"Runs on the 15th of every month at 10:00 AM IST"*, *"Next run: 15 May 2026, 10:00 AM IST"*).
- Footer: **Save**, **Delete schedule** (if existing), **Cancel**.

Form is validated client-side (mirrors trigger rules) before saving via `supabase.from("journey_schedules").upsert(...)` keyed on `journey_id`.

### 3. Shared helpers — `src/lib/journeySchedule.ts` (new)

Pure utilities (no UI, no DB) so the future scheduler/calendar can reuse:
- `summarizeSchedule(schedule)` → human-readable string.
- `computeNextRun(schedule, fromDate = now)` → `Date` in IST.
- `expandToCalendarEvents(schedule, rangeStart, rangeEnd)` → array of `{ journey_id, title, start, end }` ready for any future Calendar view.
- IST handling via `date-fns-tz` (already commonly used) with fixed `Asia/Kolkata`.

`next_run_at` is computed in the dialog using `computeNextRun` and written alongside the row so a future cron/scheduler edge function can simply `SELECT … WHERE next_run_at <= now()`.

### 4. Out of scope (kept clean for future work)

- No execution engine / cron job is added — only data + `next_run_at`. The existing journey activation logic is untouched.
- No Calendar view UI is built yet; `expandToCalendarEvents` is provided so the future Calendar can plug in directly.
- Existing Journey Builder canvas, nodes, approval workflow, and activation flow are untouched.

### Files

- **New migration** — create `journey_schedules` table + validation trigger + RLS + indexes.
- **New** `src/components/journey/JourneyScheduleDialog.tsx`
- **New** `src/lib/journeySchedule.ts`
- **Edit** `src/pages/communication/JourneyList.tsx` — add Schedule action button, schedule badge in status column, dialog wiring, and join the schedule into the journeys query.

No other files, no edge functions, no changes to existing journey logic.

