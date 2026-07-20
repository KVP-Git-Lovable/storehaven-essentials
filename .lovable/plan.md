## Set Gold Rate + Dynamic Jewellery Pricing in Orders

Add daily gold rate management on `/inventory/items` and use it to auto-price jewellery products in the New Order modal, with per-line Dia / CS / Making charges and an order-level Discount.

### 1. New table: `gold_rates`

One row per day per karat.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `rate_date` | date (unique with `karat`) |
| `karat` | text (`18K` or `22K`) |
| `price_per_gram` | numeric |
| `created_at` / `updated_at` | timestamptz |

RLS: authenticated users can read/insert/update; service_role full. GRANTs to authenticated + service_role. Unique index on `(rate_date, karat)` so save = upsert.

### 2. Inventory Items page — "Set Gold Rate" button

- Add a **Set Gold Rate** button to the header of `src/pages/inventory/InventoryItems.tsx`, placed immediately to the left of **Import Memo Inward**.
- New component `src/components/inventory/GoldRateDialog.tsx`:
  - Shows today's date (read-only, `dd MMM yyyy`).
  - Two numeric inputs: **18K – price per 1g** and **22K – price per 1g**.
  - On open, pre-fills with today's existing rates (if any).
  - **Save** upserts both rows into `gold_rates` for today, invalidates the `gold-rate-today` query, toasts success.

### 3. Order modal pricing logic

Update `src/components/transactions/OrderFormDialog.tsx`:

- Fetch products with `net_wt`, `main_metal`, plus existing fields.
- Fetch today's gold rates once (`gold-rate-today` query) → `{ "18K": number, "22K": number }`.
- Derive karat from product's `main_metal` (match `18` → 18K, `22` → 22K; fallback: no gold component → 0).
- Extend each line item state with `diaPrice`, `csPrice`, `makingCharges` (all default `"0"`, editable numeric inputs).
- **Per-line calculation:**
  - `goldValue = todaysRate(karat) * (net_wt || 0)`
  - `unitPrice` displayed = `goldValue` (read-only, derived; replaces the old `selling_price` source for jewellery lines)
  - `lineTotal = unitPrice + diaPrice + csPrice + makingCharges`  (× quantity)
  - If no gold rate is set for today OR product has no `net_wt`, fall back to product `selling_price` for `unitPrice` and show a subtle hint "Set today's gold rate".
- **Order totals block:**
  - `Subtotal = Σ lineTotal`
  - New **Discount** input (numeric, blank = 0), subtracted from Subtotal.
  - `Grand Total = (Subtotal − Discount) + Tax` (Tax stays 0 as today).
  - Persist discount into `orders.discount_amount` (already exists on `orders`; if not, add nullable column in the same migration — will confirm during exploration/build).

### 4. Modal layout

- Widen `DialogContent` from `sm:max-w-3xl` to `sm:max-w-6xl` (or `max-w-[1200px]`) so each product row fits on one line.
- Restructure line item grid to a single responsive row:
  `[Product | Qty | Unit Price | Dia Price | CS Price | Making | Line Total | 🗑]`
  Inputs for Dia/CS/Making are compact numeric fields.
- Keep mobile stacking (grid collapses to 1 col below `md`).

### 5. Scope guardrails

- No changes to WhatsApp, Journey Builder, POS, GRN, or other order-adjacent flows.
- POS (`PointOfSale.tsx`) continues to use `selling_price` — out of scope for this change (can be added later on request).
- Existing order edit/view modes keep working: on edit, load stored `unit_price` per line as-is and recompute totals from the new fields only when the user changes them.

### Technical notes

- New query key: `["gold-rate-today"]` invalidated on rate save.
- `unit_price` written to `order_items` = the composed per-unit value `(goldValue + dia + cs + making)` so downstream reports keep matching `total_amount`.
- Category-agnostic: logic is driven purely by `main_metal` + `net_wt`; non-jewellery products with no net weight fall back to `selling_price` cleanly.
