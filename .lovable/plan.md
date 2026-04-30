## Answers to your questions

### 1. How is "Current Stock" calculated today, and where is it used?

- **Source of truth:** the `stock_ledger` table. There is no `current_stock` column on `inventory_items` — stock is always derived by summing `quantity_change` for each item.
- **Helper:** `src/lib/inventoryStock.ts → getInventoryStockMap(itemIds)` runs `SELECT item_id, quantity_change FROM stock_ledger WHERE item_id IN (...)` and aggregates it client-side. There is also a SECURITY DEFINER SQL function `public.get_inventory_stock_map` that does the same on the server.
- **Where it is consumed today:**
  - `src/pages/inventory/InventoryItems.tsx` — the "Current Stock" column (via `useInventoryStockMap`).
  - `src/pages/transactions/ProductsList.tsx` — the "Stock" column on Products.
  - `src/pages/inventory/LowStockAlerts.tsx`, `ExpiryManagement.tsx` — low-stock / expiry logic.
  - `src/pages/pos/PointOfSale.tsx` and `OrderFormDialog` — checks availability (`assertStockAvailable`) and writes negative ledger rows on order completion (`recordSaleLedger`).
- **Why every item shows 0 today:** no ledger rows exist yet for these items (no GRNs, no manual openings, no sales). Until a row is written to `stock_ledger`, the sum is 0.

### 2. Edit Stock from Inventory Items — current state

The plumbing is already in place:
- `EditStockDialog` (`src/components/inventory/EditStockDialog.tsx`) supports both "Adjust by ±" and "Set exact value", validates against negative stock, and writes a `manual_adjustment` (or `opening_balance`) row via `recordManualAdjustment`.
- `InventoryItems.tsx` already renders an "Edit Stock" icon button (the `Package` icon, `title="Edit Stock"`) in the Actions column that opens this dialog.

So functionally the update path exists, but the entry point is **not discoverable** — it's an unlabeled package icon next to View/Edit/Delete. That's almost certainly why you couldn't find it. Fix is a UX surface change, not new logic.

### 3. Products page should be view-only

Currently `/transactions/products` lets users create / edit / delete products and writes back to the same `inventory_items` table. This duplicates `/inventory/items` and is the source of the confusion.

---

## Plan

### A. Make "Edit Stock" obvious on Inventory Items
- Replace the icon-only Package button with a clearly labelled action: a small **"Edit Stock"** button (icon + text) in the Actions column.
- In the row's "Current Stock" cell, make the number itself clickable → opens the same `EditStockDialog`. Add a subtle "Update" affordance on hover.
- In the View Item side-sheet ("Stock Levels" section), add a primary **"Update Current Stock"** button that opens the same dialog, plus show the live current stock value (it currently only shows Min/Max, not the actual on-hand).
- Add an "Update Stock" quick action when current stock is 0 (small inline link in the cell saying "Set opening stock") so first-time setup is one click.

No DB schema changes needed — `EditStockDialog` and `recordManualAdjustment` already do the work and write to `stock_ledger` with `transaction_type = manual_adjustment` (or `opening_balance` when current is 0).

### B. Make `/transactions/products` view-only
- Remove the **New Product** button, the **Edit** (Pencil) button, and the **Delete** (Trash) button from `ProductsList.tsx`.
- Keep the **View** (Eye) button → opens `ProductFormDialog` in `mode="view"` (already supported).
- Add a small banner / helper text at the top: *"Products are managed in Inventory → Items. This view is read-only."* with a link/button **"Manage in Inventory Items"** that navigates to `/inventory/items`.
- Drop the unused `ProductFormDialog` create/edit imports' wiring and the `deleteProductSafely` mutation from this page (file kept for use elsewhere if referenced, otherwise leave the helper module alone).
- Leave the underlying data source unchanged (still reads `inventory_items` joined with `stock_ledger`), so the view stays accurate.

### C. Small consistency tweaks
- On Inventory Items, format Current Stock as red when 0, amber when ≤ min, green otherwise — already partly done; keep behaviour but ensure the new "Edit Stock" button is always visible (not just on hover) so updating is one click from the list.
- No changes to routes, sidebar entries, or permissions — only UI behaviour on the two pages.

### Files to change
- `src/pages/inventory/InventoryItems.tsx` — relabel/expose Edit Stock button, make Current Stock cell clickable, add Update Stock CTA in the View sheet.
- `src/pages/transactions/ProductsList.tsx` — strip create/edit/delete UI, add "view-only" banner with link to Inventory Items.

### Files NOT changed
- `src/lib/inventoryStock.ts`, `src/components/inventory/EditStockDialog.tsx`, `src/hooks/useInventoryStock.ts` — already correct.
- Database — no migrations needed; `stock_ledger` and `get_inventory_stock_map` are sufficient.
