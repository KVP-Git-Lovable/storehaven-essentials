

## Fix: Journey activation enrolls 0 contacts

### Root cause

In `supabase/functions/journey-actions/index.ts`, `upsertContactsFromCustomers` writes into `public.journey_contacts` but **swallows every Supabase error silently** — no `error` destructuring, no logging. When the insert fails, `inserted` is `null`, the phone→id map stays empty, and the function returns `[]` → "0 contacts enrolled" — even though the preview correctly shows 2 customers (`Suyog Hegde Kundapura`, `Abhishek Kasaragod`) matching `total_spent ≥ 800000`.

Confirmed via DB:
- 2 customers match the list view filter, both with valid `+91…` phones.
- `journey_contacts` table is **completely empty (0 rows)** → the insert never landed.
- `journey_enrollments` for this journey: **0 rows**.
- Edge function logs show only boot/shutdown — no error trace because nothing is logged.

The most likely concrete failure inside the insert is the synthetic `email` value (`919148181465@noemail.local`) violating something downstream, OR the `name` field being NULL for one row, OR a transient permission/trigger. Without error capture we can't know — and we don't need to: the fix is to make the path **error-visible**, **idempotent**, and **resilient to per-row failures**.

### Fix

Edit `supabase/functions/journey-actions/index.ts` → `upsertContactsFromCustomers` (and surrounding `activate` flow):

1. **Capture and log errors** on every `journey_contacts` query (`select`, `insert`). Throw with the Postgres message so it surfaces in the toast and edge logs.
2. **Insert one row at a time** in a `for` loop instead of a single bulk insert, so one bad row (e.g. duplicate email, NULL name) doesn't drop the entire batch. Wrap each in try/catch, log+skip failures, continue.
3. **Sanitize fields defensively**:
   - `name`: fallback to `c.name?.trim() || "Customer"` (current `||` already covers empty string, keep but trim).
   - `email`: ensure uniqueness-safe synthetic — `journey+${digits}@noemail.local`.
   - Drop `city` from the insert payload entirely (the `customers` table has no `city` column, so it's always null — harmless but noisy; remove for clarity).
   - `segment_type`: map `customer_segment` directly; if null → `'customer'`.
4. **Re-fetch by phone after inserts** so we pick up rows that were inserted in this call AND any pre-existing rows, regardless of insert success path.
5. **Surface enrollment diagnostics** in the activate response: include `{ enrolled, matched, skipped, reason? }` so the UI toast can show "Activated — 2 of 2 enrolled" or the skip reason.
6. **Update toast in `JourneyBuilder.tsx`** to show the richer message when `matched > enrolled`.

### Files to edit

- `supabase/functions/journey-actions/index.ts` — robust per-row upsert with error logging; richer activate response.
- `src/pages/communication/JourneyBuilder.tsx` — surface `matched`/`skipped` counts in the success toast and an error toast if `enrolled === 0` while `matched > 0` (with the first failure reason).

### Verification after fix

After re-activating the journey **"10% Discount for 8L purchased customers"**:
- `journey_contacts` will contain rows for `+919148181465` and `+919741435887`.
- `journey_enrollments` will have 2 active rows pointing at the entry node.
- Within ~60 seconds the `journeys-tick` cron will advance them to the Message node, invoke `whatsapp-send` with template `highvalue_8lakh` (`HX807de5f45cf0e60b26d89cb5d3617142`), then to Exit.
- Toast will read: *"Journey activated — 2 contacts enrolled"*.

