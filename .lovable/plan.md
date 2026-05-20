# Relative Date Scheduling for Journeys

Extend the existing Journey Schedule dialog to support a third scheduling mode — **Relative Date** — driven by date/datetime fields on the journey's audience entity. Fixed-date (One-time) and Recurring flows remain untouched.

## UX changes (`src/components/journey/JourneyScheduleDialog.tsx`)

Top-level "Type" segmented control becomes 3 tabs:

```text
[ One-time ]  [ Recurring ]  [ Relative Date ]
```

- **One-time** — unchanged (Date + Time IST).
- **Recurring** — unchanged (Frequency / DoW / DoM / MoQ + Time IST).
- **Relative Date** — new panel:
  - **Base Entity** (Select) — populated from `ENTITY_SCHEMAS` in `src/lib/listViewSchema.ts`, pre-filled from the journey's `list_view.entity_type` when present.
  - **Date Field** (Select) — only fields where `type === "date"` for that entity (date/datetime/timestamp). Lazy-loaded from the schema; nothing renders until entity is picked.
  - **Rule** segmented control: `Before` / `On exact day` / `After`.
  - **Offset** row (hidden when rule = "On exact day"): number input + unit select (`Days` / `Weeks` / `Months`).
  - **Time (IST)** picker — same component as other modes.
  - **Retrigger policy** (radio group):
    - `Only once per record` (default)
    - `Every time the field changes`
    - `Repeat allowed` (re-fires every time the computed date is reached again — e.g. annual recurrence on a birthday field)
  - **Preview text** block (replaces existing "One-time schedule" summary). Examples:
    - `15 days after Customer · Last Purchase Date at 9:00 AM IST`
    - `On Customer · Date of Birth at 9:00 AM IST · repeats yearly`
    - `3 days before Order · Created Date at 6:00 PM IST · once per record`
  - Next-run line shows `Evaluated daily — first matches within next 24h: <count>` (optional best-effort read-only count via a lightweight query; see Technical section, can be added in a follow-up if needed).

All existing dialog plumbing (Cancel / Save / Delete schedule, validation toasts, mutation invalidation) is reused. Save button disabled unless: entity + field + time set; offset ≥ 0; unit chosen when rule ≠ "on exact day".

## Data model

New schedule type `relative` added alongside `one_time` / `recurring`. New nullable columns on `journey_schedules`:

| Column | Type | Purpose |
| --- | --- | --- |
| `relative_entity` | text | e.g. `customers`, `orders` |
| `relative_field` | text | column name on entity table |
| `relative_rule` | text | `before` \| `after` \| `on` |
| `relative_offset` | integer | non-negative, ignored when rule = `on` |
| `relative_unit` | text | `days` \| `weeks` \| `months` |
| `retrigger_mode` | text | `once` \| `on_change` \| `repeat` |

`type` CHECK relaxed to allow `relative`. Validation trigger `validate_journey_schedule()` updated:
- `relative` requires `relative_entity`, `relative_field`, `relative_rule`, `execution_time`, `retrigger_mode`; requires `relative_offset` + `relative_unit` when rule ≠ `on`.
- `relative` forbids `execution_date`, `frequency`, `days_of_week`, `day_of_month`, `month_of_quarter`.

New table `journey_relative_fires` to support retrigger semantics:

| Column | Type |
| --- | --- |
| `id` | uuid pk |
| `journey_id` | uuid fk |
| `record_id` | text (entity row id) |
| `last_field_value` | timestamptz |
| `last_fired_at` | timestamptz |

Unique `(journey_id, record_id)`. RLS: same authenticated read/write pattern as other journey tables.

## Frontend lib (`src/lib/journeySchedule.ts`)

- Extend `ScheduleType = "one_time" | "recurring" | "relative"`.
- Extend `JourneySchedule` interface with the new optional fields above.
- `summarizeSchedule` — new branch produces the human preview strings shown in the dialog.
- `computeNextRun` — for `relative`, return `null` (per-record evaluation lives server-side); summary takes precedence in the UI's "Next run" line.

## Backend (`supabase/functions/process-journeys/index.ts` + `_shared/journey-schedule.ts`)

- Shared `JourneySchedule` interface mirrors the new fields.
- `runScheduleSweep` gains a new branch when `sched.type === "relative"`:
  1. Resolve the journey's audience entity rows via the existing list-view filter pipeline (reuses `fetchAllRows`).
  2. For each row, compute `target = row[relative_field] ± offset/unit @ execution_time IST`.
  3. Look up `journey_relative_fires` for `(journey_id, row.id)`.
  4. Decide whether to fire:
     - `once`: fire only if no prior fire row.
     - `on_change`: fire if no prior row OR `last_field_value` differs from current field value.
     - `repeat`: fire if `target` is in the past relative to last fire (or no prior fire) and within the sweep window.
  5. Window check: `target <= now` AND (`target > last_fired_at` OR `last_fired_at IS NULL`) AND `target >= now - 24h` (guards against backfilling years of history).
  6. On fire: enroll the resolved contact (re-using `upsertContactsFromCustomers` / contactKey logic) and upsert into `journey_relative_fires` with new `last_field_value` and `last_fired_at`.
- For `relative` schedules `next_run_at` is set to `now() + 1 hour` (sweep cadence) on every sweep so the row stays eligible for re-evaluation. No "fire once and stop" semantics like `one_time`.
- Cron cadence (existing pg_cron job invoking `process-journeys`) is unchanged; it already runs frequently enough to catch the 24h window.

## Field discovery

Schema-driven. The dialog reads `ENTITY_SCHEMAS` and filters `fields` where `type === "date"`. No DB introspection — keeps it deterministic and matches what the List View builder already exposes. Future entity additions automatically appear.

## Out of scope

- No changes to fixed One-time or Recurring scheduling logic.
- No changes to JourneyBuilder canvas, AudienceBuilder, message rendering, or List View builder.
- No DB introspection / dynamic schema crawl — relies on existing `listViewSchema.ts` registry.

## File touch-list

- `src/components/journey/JourneyScheduleDialog.tsx` — new tab + Relative panel + preview.
- `src/lib/journeySchedule.ts` — type extensions, summary branch.
- `supabase/functions/_shared/journey-schedule.ts` — shared type extension + relative resolver helper.
- `supabase/functions/process-journeys/index.ts` — sweep branch for relative.
- New migration: extend `journey_schedules`, update validator, create `journey_relative_fires` with RLS.
