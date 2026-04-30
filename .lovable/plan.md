## Add stock visibility + manual stock adjustment on Inventory Items

### Important context (what already exists, do not duplicate)

The previous refactor already delivered most of this spec — verified against the codebase:

- **Orders use `inventory_items` as product source** — `OrderFormDialog.tsx` queries `inventory_items` and the dropdown label is already `"Name — ₹price (Stock: N)"`.
- **Out-of-stock disables selection** — `disabled: stock <= 0` on the dropdown options.
- **Stock guard on order placement** — `assertStockAvailable()` rejects with `"Insufficient stock — …"` before insert.
- **Stock decrement on order placement** — `recordSaleLedger()` writes negative `stock_ledger` rows tagged `transaction_type='sale'`, `reference_type='order'`, `reference_id=order.id`. This is the equivalent of the `inventory_movements` table the spec describes — already audited, signed, and joined to the order.
- **Real-time stock map** — `getInventoryStockMap` + `useInventoryStockMap` hook already aggregate the ledger.

What's actually missing is **only on the Inventory Items page**: the Stock column and the Edit Stock modal.

### Decision: keep `stock_ledger`, do NOT add a `stock_quantity` column or a parallel `inventory_movements` table

The spec asks for a `stock_quantity` column and an `inventory_movements` audit table. The codebase already implements both concepts via `stock_ledger` (sum of `quantity_change` = current stock; every row is a fully-attributed movement with `reference_type`/`reference_id`/`created_by`/`created_at`). Adding a denormalised column would create drift; adding `inventory_movements` would duplicate `stock_ledger`. Both would also break the working order flow.

If you'd prefer the literal column + separate table approach, say so and I'll re-plan — but it's a net regression vs. what's already shipped.

### Changes

#### 1. `src/pages/inventory/InventoryItems.tsx` — add Stock column

- Use `useInventoryStockMap(items.map(i => i.id))` to fetch current stock for all listed items.
- Insert a new "Stock" column in the items table between "Unit" (or wherever appropriate) and the actions column. Show the integer; render `0` in muted red when ≤ 0 and below `min_stock` in amber.
- Add an "Edit Stock" action (Package icon button) in the row actions, alongside Edit/Delete.

#### 2. New component `src/components/inventory/EditStockDialog.tsx`

Props: `{ open, onOpenChange, item: { id, name, unit, unit_cost } }`.

UI:
- Read-only "Current Stock" line (from `getInventoryStockMap([item.id])`, refetched on open).
- Mode toggle (segmented control): **Adjust by ± / Set to exact value**.
- Quantity input (integer, can be negative in Adjust mode).
- Optional "Reason / Notes" text input.
- Live preview: "New stock will be: X".
- Block submit if resulting stock would be negative.

On submit, insert one row into `stock_ledger`:
- `item_id`: item.id
- `location_type`: `'global'`, `location_id`: null (matches the order-flow convention when no store context exists).
- `transaction_type`: `'manual_adjustment'` (Adjust mode) or `'opening_balance'` (Set mode when current stock is 0) / `'manual_adjustment'` (Set mode when non-zero, with `quantity_change = target - current`).
- `quantity_change`: signed delta.
- `unit_cost`: item.unit_cost ?? 0.
- `reference_type`: `'manual'`, `reference_id`: null.
- `notes`: user-entered reason.
- `created_by`: current `auth.uid()` (or `'manual-adjustment'` fallback).

After success: `qc.invalidateQueries({ queryKey: ["inventory-stock-map"] })`, refetch items, toast success, close dialog.

#### 3. Small helper additions to `src/lib/inventoryStock.ts`

Add `recordManualAdjustment({ itemId, delta, unitCost, notes })` so the dialog doesn't have to know the ledger schema. Keeps the abstraction consistent with `recordSaleLedger`.

### What we explicitly will NOT do

- Add a `stock_quantity` column to `inventory_items`.
- Create an `inventory_movements` table (would duplicate `stock_ledger`).
- Touch `OrderFormDialog`, `PointOfSale`, or any order-side flow — already correct.
- Drop the `products` table.

### Files

- Edit: `src/pages/inventory/InventoryItems.tsx`
- New: `src/components/inventory/EditStockDialog.tsx`
- Edit: `src/lib/inventoryStock.ts` (add `recordManualAdjustment`)

### Verification after build

1. Open `/inventory/items` → confirm Stock column is visible and matches `stock_ledger` sums.
2. Click Edit Stock on an item → set to 10 → save → row shows 10.
3. Adjust by -3 → row shows 7.
4. Try to adjust by -100 → submit blocked with "Stock cannot go negative".
5. Open `/transactions/orders` → New Order → that item shows `(Stock: 7)` and is selectable; create order qty 2 → row shows 5; order qty 99 → rejected with "Insufficient stock — …".
