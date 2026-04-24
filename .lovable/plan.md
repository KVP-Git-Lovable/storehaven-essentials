

## Bulk Order Import (Template → Upload → Validate → Import)

Add a controlled bulk-import flow to the **Orders** page (`/transactions/orders`). Nothing is written to the database until the user reviews validation results and clicks Import.

### 1. UI entry point — `OrdersList.tsx` header

Next to "New Order", add a second button **`Import Orders`** (Upload icon). Opens a full-screen Dialog `OrderImportDialog` with three steps:

```text
[ Step 1: Download ] → [ Step 2: Upload ] → [ Step 3: Validate & Confirm ]
```

A persistent **Download Template** button is shown in steps 1 & 2.

### 2. Template — CSV + XLSX

`Download Order Import Template` generates a file with the exact required columns and one example row:

| order_id (optional) | customer_phone* | customer_name | product_name* | quantity* | unit_price* | order_date* | status |
|---|---|---|---|---|---|---|---|
| (blank) | 9876543210 | Asha Mehta | Premium Coffee 250g | 2 | 450 | 2026-04-20 | completed |

- Default download = **CSV** (zero deps). A second link **"Download as Excel (.xlsx)"** uses the `xlsx` npm package (already common; we'll add it via `npm i xlsx` if not present) to emit a `.xlsx` with a styled header row.
- Same column order is enforced on import; extra columns are ignored, missing required columns block parsing with a clear error.

### 3. Upload & parse — client-side only

- Accept `.csv`, `.xlsx` (single file). Drag-drop + file picker.
- Parse with `xlsx` library (handles both formats via `XLSX.read`).
- No DB writes here. Result feeds the validation step.
- Soft cap: 5,000 rows per file (warn above; hard-stop above 10,000 to protect the browser).

### 4. Validation engine (pure client function)

Pre-fetch lookup maps once for the whole file:
- `customers`: `select id, name, phone` (all rows) → `Map<phone, {id,name}>`
- `products`: `select id, name` (all rows) → `Map<lowercased name, id>` (case-insensitive exact match; if multiple share a name, surface as warning + pick first)
- `orders`: `select order_number` for any non-blank `order_id` values in file → `Set<order_number>` for duplicate check

Per-row checks (in this order; collect ALL issues per row, don't stop at first):

| Field | Rule | Severity |
|---|---|---|
| customer_phone | non-empty, 10-15 digits | error |
| customer | phone found in customers map | OK; else error `Customer not found` (will be auto-created if `customer_name` provided, else error) |
| customer name match | if phone exists & file `customer_name` differs from DB `name` (case-insensitive trim) | warning `Customer name mismatch (DB: "Asha M.")` |
| product_name | found in products map | error `Product not found` |
| quantity | integer > 0 | error `Invalid quantity` |
| unit_price | numeric ≥ 0 | error `Invalid price` |
| order_date | parses to a real date (`yyyy-MM-dd` or Excel serial) | error `Invalid date` |
| order_id | if non-blank and already in orders.order_number | error `Duplicate order` |
| status | if provided, must be one of `pending/completed/cancelled/refunded`; default `completed` | warning if invalid → coerced to `completed` |

A row is **valid** iff zero errors (warnings allowed).

### 5. Validation preview UI

Sticky summary banner at top:
```text
Total: 120   ✅ Valid: 105   ⚠ Warnings: 8   ❌ Invalid: 15
```

Table (virtualised if >200 rows via simple windowing):

| # | Status | Customer (phone · name) | Product | Qty | Price | Date | Order Status | Issues |
|---|---|---|---|---|---|---|---|---|

- Status column: `CheckCircle2` (green) / `AlertTriangle` (yellow) / `XCircle` (red).
- Issues column: chips listing every error/warning message (full text in tooltip if truncated).
- Filter pills above table: **All · Valid · Warnings · Invalid**.
- Footer actions:
  - **Cancel Import** (destructive outline) — closes dialog, no writes.
  - **Download Error Rows** (outline) — exports invalid rows + an `errors` column to CSV.
  - **Import Valid Rows Only** (primary, disabled when valid count = 0) — proceeds to insertion.

### 6. Insertion logic (only for valid rows)

Runs inside a single mutation with progress toast. For each valid row:

1. **Customer**:
   - If phone exists → use existing `customer_id`.
   - Else (auto-create allowed because validation already required `customer_name`) → insert into `customers (phone, name)` and use new id.
   - Customer name mismatch warnings do **not** update existing customer records (non-destructive by design).
2. **Order**:
   - Insert into `orders` with: `order_number` = file `order_id` if provided, else generated `IMP-YYYYMMDD-<6char>`, `customer_id`, `subtotal=quantity*unit_price`, `total_amount=subtotal`, `payment_method='import'`, `payment_status='pending'`, `status` from row, `created_by='Bulk Import'`, `created_at` = parsed `order_date`.
3. **Order item**:
   - Insert into `order_items` with the resolved product `item_id`, `quantity`, `unit_price`, `total_amount=quantity*unit_price`.

Inserts are **chunked in batches of 50** customers/orders/items to avoid request size limits. Each batch wrapped with per-row try/catch so a single failure doesn't abort the whole batch — failures are appended to a runtime "post-insert errors" list shown after import.

### 7. Import logging — new table `order_import_logs`

Migration:
```sql
create table public.order_import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  warning_count integer not null default 0,
  imported_by uuid references auth.users(id),
  error_summary jsonb default '[]'::jsonb,  -- compact list of {row, errors[]}
  created_at timestamptz not null default now()
);
alter table public.order_import_logs enable row level security;
create policy "admins_all" on public.order_import_logs for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "users_read_own" on public.order_import_logs for select to authenticated using (imported_by = auth.uid());
create policy "users_insert_own" on public.order_import_logs for insert to authenticated with check (imported_by = auth.uid());
```

One log row per import (created at import completion). Not exposed in UI in this iteration — stored for audit / future reporting.

### 8. Files to add / change

- **New** `src/components/transactions/OrderImportDialog.tsx` — the 3-step dialog (download / upload / validate-preview) with all state + mutations.
- **New** `src/lib/orderImport.ts` — pure helpers: template generation (CSV + XLSX), file parsing, validation engine, error-row CSV export. Unit-test friendly.
- **Edit** `src/pages/transactions/OrdersList.tsx` — add `Import Orders` button + dialog mount; invalidate `transactions-orders` and `transactions-customers` on success.
- **DB migration** — `order_import_logs` table with RLS as above.
- **Dependency** — add `xlsx` (SheetJS) to `package.json` if not already present.

### 9. Constraints honoured

- No row hits the DB before the user clicks **Import Valid Rows Only**.
- Invalid rows are never inserted — they can only be re-downloaded for correction.
- Existing `orders` / `order_items` / `customers` schema is untouched.
- All inserts respect existing RLS; the dialog is rendered from the same authenticated context as the page.
- Performance: lookups are 3 batched selects regardless of file size; inserts chunked at 50.

