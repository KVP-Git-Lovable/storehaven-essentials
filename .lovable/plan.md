## Refactor: Inventory Items as the single source of truth for products

### Important findings before we change anything

- `inventory_items` does **not** have a `stock_quantity` column. Stock is computed from `stock_ledger` (sum of `quantity_change` per `item_id` + `location_type`/`location_id`). The same applies to `products.stock_qty` consumers today.
- Field name differences between the two tables:
  - `products.price` ↔ `inventory_items.selling_price`
  - `products.stock_qty` ↔ derived from `stock_ledger`
  - `products` has `brand`, `model`, `warranty`, `tax_rate`, `image_url`, `is_favorite`, `cost_price` — none exist on `inventory_items`.
- `order_items` already uses `item_id` (not `product_id`). No schema change needed there — only the source we read from.
- Both `products` and `inventory_items` tables are currently empty (0 rows), so data migration is a no-op now but we'll still ship a safe, idempotent copy script for any future seed data.

### Plan

1) Schema additions to `inventory_items` (non-breaking, all nullable)
   - Add `brand text`, `model text`, `warranty text`, `tax_rate numeric`, `image_url text`, `is_favorite boolean default false`, `cost_price numeric`.
   - Add a generated/maintained `stock_quantity` view-like helper: introduce a SQL function `get_inventory_stock(item_id uuid)` returning `coalesce(sum(quantity_change),0)` from `stock_ledger`. (Avoids denormalising stock onto the row, matches existing system design.)
   - Add unique index on `inventory_items.sku` only where `sku is not null` (if not already present) to keep parity with products.

2) Data migration (idempotent, preserves IDs)
   - One-shot SQL: `INSERT INTO inventory_items (id, name, sku, barcode, category, unit, unit_cost, selling_price, min_stock, status, brand, model, warranty, tax_rate, image_url, is_favorite, created_at) SELECT id, name, sku, barcode, coalesce(category,'General'), 'pcs', coalesce(cost_price,0), coalesce(price,0), coalesce(min_stock,0), 'active', brand, model, warranty, tax_rate, image_url, coalesce(is_favorite,false), created_at FROM products ON CONFLICT (id) DO NOTHING;`
   - For each migrated product with `stock_qty > 0`, insert a single `stock_ledger` opening-balance row (`transaction_type='opening_balance'`) so derived stock matches.

3) Application refactor — switch reads from `products` → `inventory_items`
   - `src/components/transactions/OrderFormDialog.tsx`: query `inventory_items` selecting `id, name, selling_price as price`, filter `status='active'`. Show available stock in the dropdown using a batched `stock_ledger` aggregation query; disable items with stock ≤ 0.
   - `src/components/transactions/LeadConvertDialog.tsx`: same swap.
   - `src/components/transactions/OrderImportDialog.tsx`: name lookup against `inventory_items`.
   - `src/pages/transactions/ProductsList.tsx` + `ProductFormDialog.tsx`: read/write `inventory_items` while preserving the existing UI (map `selling_price` ↔ `price`, derive stock from ledger). Keep the page route unchanged.
   - `src/pages/pos/PointOfSale.tsx` and `src/pages/pos/ProductMaster.tsx`: read `inventory_items`. POS write paths (favourite toggle etc.) move to `inventory_items`.
   - `src/pages/assets/Products.tsx` and `src/pages/stores/StoreTargetDetails.tsx`: switch to `inventory_items` reads.
   - `src/lib/productDeletion.ts`: delete from `inventory_items` (also clean dependent ledger rows where safe).

4) Order placement — stock decrement
   - On successful order create (OrderFormDialog, PointOfSale): for each line item, insert a `stock_ledger` row with `transaction_type='sale'`, `quantity_change = -quantity`, `reference_type='order'`, `reference_id=order.id`. This keeps stock derivation consistent and reversible.
   - Add a guard before submit: re-fetch current stock for selected items; reject if any line quantity exceeds available stock.

5) Validation in dropdowns
   - Helper `useInventoryStockMap(itemIds)` → returns `{ [id]: number }` from a single grouped `stock_ledger` query.
   - In dropdowns: label as `"<name> — ₹<price> (Stock: N)"`, mark out-of-stock entries disabled and visually muted.

6) Backward compatibility
   - `order_items.item_id` unchanged.
   - `products` table is **kept** (not dropped). All writes are redirected; existing rows remain readable.
   - `src/pages/assets/Products.tsx` keeps its route; only the underlying source changes.

### Files to edit / add

- Migration: `supabase/migrations/<ts>_inventory_as_source_of_truth.sql` (schema additions, data copy, opening-balance ledger inserts, stock helper function).
- New: `src/lib/inventoryStock.ts` (`getStockMap`, `assertStockAvailable`).
- New: `src/hooks/useInventoryStock.ts` (React Query wrapper).
- Edit: `OrderFormDialog.tsx`, `LeadConvertDialog.tsx`, `OrderImportDialog.tsx`, `ProductsList.tsx`, `ProductFormDialog.tsx`, `PointOfSale.tsx`, `pos/ProductMaster.tsx`, `assets/Products.tsx`, `stores/StoreTargetDetails.tsx`, `lib/productDeletion.ts`.

### What we explicitly will NOT do

- Drop or rename the `products` table.
- Change `order_items` columns or any RLS policy semantics.
- Add a denormalised `stock_quantity` column on `inventory_items` (we use the existing `stock_ledger` design; the spec's "stock_quantity" is exposed via a helper function/view rather than a stored column, to avoid drift).

If you'd prefer a literal `stock_quantity` column on `inventory_items` (kept in sync via trigger on `stock_ledger`) instead of the helper-function approach, say the word and I'll adjust step 1 + 4 accordingly.