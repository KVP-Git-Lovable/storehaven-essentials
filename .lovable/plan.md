## Goal
Replace the "Set Gold Rate" modal on `/inventory/items` with a new **Price Configuration** page containing three sections: Gold Rate (with 14K added), Diamond Rate, and CS Rate.

## Changes

### 1. Database (migration)
- Extend `gold_rates.karat` usage to accept `14K` (already a text column, no schema change needed — just allow new value).
- New table `diamond_rates`:
  - `id`, `particulars` (text, e.g. "ROUND/FANCY"), `size_label` (text, e.g. "-2 TO 29 POINTER"), `price_per_ct` (numeric), `sort_order` (int), `effective_date` (date), timestamps.
  - Seeded with the 10 rows from the reference image (ROUND/FANCY across sizes -2 to 29 pointer through 5.00 carat).
  - RLS: authenticated read/write; GRANTs for authenticated + service_role.
- New table `cs_rates`:
  - `id`, `rate_date` (date, unique), `price_per_gram` (numeric), timestamps.
  - RLS + GRANTs as above.

### 2. New page `src/pages/inventory/PriceConfiguration.tsx`
Three cards on one page:
- **Gold Rate** — date (today, readonly), three inputs: 14K, 18K, 22K price/gram. Save upserts into `gold_rates` on `(rate_date, karat)`. Migrated from the existing `GoldRateDialog` logic.
- **Diamond Rate** — editable table. Columns: SR NO (static), PARTICULARS (static), SIZE (static), PRICE/CT (input, green background). Save updates all rows. New rows can be added later; for now, seeded 10 rows are edited in place.
- **CS Rate** — date (today, readonly) + single input for CS price/gram. Save upserts into `cs_rates` on `rate_date`.

### 3. Routing & entry point
- Register `/inventory/price-configuration` in `src/App.tsx`.
- In `src/pages/inventory/InventoryItems.tsx`, remove the `<GoldRateDialog />` button and add a **Price Configuration** button (link) in the same header position.
- Leave `GoldRateDialog.tsx` and existing OrderFormDialog gold-rate lookup untouched (still reads today's `gold_rates`).

### 4. Note
- Diamond and CS rates are stored but not yet wired into Order calculations — you mentioned the Dia formula will come later. CS formula (`colour_stone_wt × cs_rate`) is captured in the plan but not applied to `OrderFormDialog` until you confirm you want that switch now.

## Out of scope
- Changing the Order form's Dia/CS price computation. Ask separately once formulas are ready.
