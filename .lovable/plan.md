

# Plan: Hide Segment, Fix Orders Counts, Move List Views into Each Page

## 1. Hide "Segment" column

**`src/pages/transactions/CustomersList.tsx`** — remove the `Segment` `<TableHead>` and its `<TableCell>`, and update the `colSpan` from 9 → 8.

(Optional: also drop "Segment" from the CSV template in `ListViewsList.tsx` — keeping it for backward compat is fine; will leave as-is unless you want it removed.)

## 2. Fix unrealistic Orders counts

Current data has e.g. 93,792 orders for ₹4.96L spent — clearly a seeding bug.

**Fix via data update (insert tool, no schema change):**
For every customer, derive a realistic order count from `total_spent` using an average order value of **₹3,500** (typical jewellery store basket), with ±25% randomness, and clamped to a sensible range:

```sql
UPDATE customers
SET total_orders = GREATEST(
  1,
  LEAST(
    200,
    ROUND( (total_spent / (2800 + random() * 1400))::numeric )::int
  )
);
```

Result: a customer who spent ₹4.96L will show ~120–180 orders; a customer who spent ₹3,500 will show ~1 order. Proportional and believable.

Note: the 80 real `orders` rows we seeded earlier remain intact — only the aggregate `total_orders` column is corrected. The `update_customer_stats` trigger only fires on new orders, so this manual recompute is safe.

## 3. Move "List Views" into each Transactions page; remove from Communication Center

### 3a. Sidebar
**`src/components/layout/AppSidebar.tsx`** — delete the `{ title: "List Views", href: "/list-views", … }` child from the **Communication Center** group. Routes (`/list-views`, `/list-views/new`, `/list-views/:id`) stay registered so existing journey deep-links still work.

### 3b. New shared component
**New: `src/components/transactions/EntityListViewsBar.tsx`** — a compact toolbar that, given an `entity` (`"customers" | "products" | "orders"`):
- Fetches `list_views` filtered by `entity_type = entity`
- Renders each as a clickable chip/button. Clicking applies the saved filters to the page's table (passes filters back via callback) and highlights the active one.
- "All records" chip resets filters.
- Dropdown menu next to each chip: **Edit** → `/list-views/{id}`, **Duplicate**, **Delete**.
- Trailing **+ New List View** button → `/list-views/new?entity={entity}` (pre-selects entity in the builder).

### 3c. List View Builder pre-select
**`src/pages/listviews/ListViewBuilder.tsx`** — when `isNew` and the URL has `?entity=customers|products|orders`, initialise `entityType` from the query param and lock the Entity dropdown (still editable but defaulted). After save, navigate back to `/transactions/{entity}` instead of `/list-views/{id}` when arrived via `?entity=`.

### 3d. Wire toolbar + "New record" button into each page

Each of the three transactions pages gets the same header layout:

```
[Search input]   [List View chips: All | High Value | Birthdays… | + New List View]   [+ New {Entity}]
```

**`src/pages/transactions/CustomersList.tsx`**
- Add `<EntityListViewsBar entity="customers" onApply={setActiveFilters} />`
- Add **"+ New Customer"** button → opens a `CustomerFormDialog` (new) that inserts into `customers` (fields: name, phone, email, tier, DOB, anniversary). Refetches on success.
- When `activeFilters` is set, query merges those filters using existing `executeListView` from `src/lib/listViewExecutor.ts` (already supports all operator types incl. `upcoming_anniversary_n_days`).

**`src/pages/transactions/ProductsList.tsx`**
- Add `<EntityListViewsBar entity="products" />`
- Add **"+ New Product"** button → `ProductFormDialog` (new): name, sku, category, brand, price, stock_qty, model, warranty (nullable defaults).

**`src/pages/transactions/OrdersList.tsx`**
- Add `<EntityListViewsBar entity="orders" />`
- Add **"+ New Order"** button → `OrderFormDialog` (new): customer (SearchableSelect), product (SearchableSelect), quantity, status. Auto-computes `total_amount = price × qty`, generates `order_number`, inserts both `orders` + `order_items`. The existing `update_customer_stats` trigger updates customer aggregates automatically.

### 3e. Cleanup `ListViewsList.tsx` (now unreachable from sidebar)
Leave the file in place (route still works for direct links) but no nav entry. No code change required.

## Files Touched

**Edited:**
- `src/components/layout/AppSidebar.tsx` — remove List Views from Communication Center
- `src/pages/transactions/CustomersList.tsx` — hide Segment, add list-view bar + New Customer
- `src/pages/transactions/ProductsList.tsx` — add list-view bar + New Product
- `src/pages/transactions/OrdersList.tsx` — add list-view bar + New Order
- `src/pages/listviews/ListViewBuilder.tsx` — accept `?entity=` query param + redirect back

**New:**
- `src/components/transactions/EntityListViewsBar.tsx`
- `src/components/transactions/CustomerFormDialog.tsx`
- `src/components/transactions/ProductFormDialog.tsx`
- `src/components/transactions/OrderFormDialog.tsx`

**Data updates (insert tool):**
- Recompute `customers.total_orders` proportional to `total_spent`

## Non-breaking guarantees

- `/list-views/*` routes remain functional (Journey Builder still uses them)
- POS pages, schemas untouched
- Existing seeded orders/customers/products data preserved
- `customer_segment` column kept in DB (only hidden in UI) — Journey Builder segmentation still works

