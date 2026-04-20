
The user wants to add a "next N days" operator for date fields in List View filters. Currently there's only `last_n_days`. Need to add `next_n_days` that filters records where the date falls between today and today+N days.

Key consideration for `date_of_birth` / `anniversary_date`: these are recurring annual events. A naive `date BETWEEN today AND today+N` won't work because birth years are in the past. Need a recurring-date check (month-day comparison).

Plan:

# Plan: Add "Next N Days" Date Filter (with Recurring Birthday/Anniversary Support)

## Problem

The current List View filter system supports `last_n_days` for dates but has no forward-looking equivalent. For recurring events like birthdays and anniversaries, even a simple `next_n_days` (today → today+N) fails because the stored year is in the past — we need to compare month/day only.

## Solution — Two new operators

Add to `src/lib/listViewSchema.ts` under date operators:

1. **`next_n_days`** — "in next N days" — for one-off future dates (e.g., Created Date doesn't make sense here, but useful for End Date, Anniversary as absolute, etc.)
2. **`upcoming_anniversary_n_days`** — "upcoming in next N days (recurring)" — month/day comparison, ignores year. Shown only for fields flagged as recurring.

## Schema changes

`src/lib/listViewSchema.ts`:
- Add an optional `recurring?: boolean` flag on `FieldDef`.
- Mark `date_of_birth` and `anniversary_date` on the customers entity as `recurring: true`.
- Extend `OPERATORS_BY_TYPE.date` with the two new operators.
- (Optionally) filter operators per-field at render time so `upcoming_anniversary_n_days` only appears for recurring fields.

## Executor changes

`src/lib/listViewExecutor.ts` — add cases:

- **`next_n_days`**: 
  ```
  q.gte(field, today).lte(field, today + N days)
  ```
- **`upcoming_anniversary_n_days`**: Postgres has no clean way to express "month-day in next N days" via PostgREST filter operators. Two options:
  - **(a)** Add a SECURITY DEFINER SQL function `customers_with_upcoming_event(field text, days int)` returning matching IDs, then use `q.in('id', ids)`. Cleanest but adds a DB function.
  - **(b)** Fetch candidate rows (filter by `is not null`), then post-filter client-side by computing this year's occurrence and checking the window. Simpler, no migration; fine for typical customer volumes (<10k). Wraps year-end correctly.
  - **Recommendation: (b)** for v1 — no schema/migration churn, matches the "no DB changes unless needed" pattern used earlier in this project.

## FilterRow UI

`src/components/listviews/FilterRow.tsx`:
- When `operator === "next_n_days"` or `"upcoming_anniversary_n_days"`, render a numeric input (same pattern as `last_n_days`) with placeholder "Number of days" and label hint "e.g., 7 for next week".
- Hide `upcoming_anniversary_n_days` from the operator dropdown unless `fieldMeta.recurring === true`.

## Server resolver parity

`supabase/functions/list-view-resolve/index.ts` — mirror the executor logic so journey activation produces the same audience as the preview. For the recurring case, use the same client-side post-filter approach inside the edge function (it already has the Supabase client).

## Backward compatibility

- Existing saved views are unaffected (only new operator values added).
- Old `last_n_days` continues to work.
- No DB migration required.

## Files Touched

- `src/lib/listViewSchema.ts` — new operators + `recurring` flag on date fields
- `src/lib/listViewExecutor.ts` — handle `next_n_days` + recurring post-filter
- `src/components/listviews/FilterRow.tsx` — show/hide operator based on field, numeric input for N
- `supabase/functions/list-view-resolve/index.ts` — parity with executor

## How the user will use it

1. Open New List View → Entity = Customers
2. Add filter → Field = `Date of Birth` → Operator = **"upcoming in next N days"** → Value = `7`
3. Save view as e.g. "Birthdays This Week"
4. The view always returns customers whose birthday falls within the next 7 days from today — no need to edit dates ever again.

