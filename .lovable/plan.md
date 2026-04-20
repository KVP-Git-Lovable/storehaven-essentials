

## Investigation

Let me check existing schema and sidebar structure before planning.
<lov-tool-use id="toolu_vrtx_01QfT5SCJgM2zmYYTnPh3kam" name="code--exec" integration-id="code" data="{\"command\": \"psql -c \\\"\\\\d public.customers\\\" 2>&1 | head -40 & psql -c \\\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('orders','products','order_items','pos_products')\\\" 2>&1 &\\nwait\", \"user_facing_description\": \"Checking existing schema\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Y9GCszSmXLraPZHq6xU3ZK" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%product%' OR table_name ILIKE '%order%' OR table_name = 'customers') ORDER BY table_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NLN5TiduugBi5cW3bdvkKw" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/layout/AppSidebar.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013P4htAyLVoKYcmEgCscj6Z" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','orders','customers') ORDER BY table_name, ordinal_position;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GskjaxWs5TVfLaD4eJ91Jz" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/listViewSchema.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GipJQNMaQXWpLYybw9BUUT" name="code--exec" integration-id="code" data="{\"command\": \"grep -n \\\"Transactions\\\\|Communication Center\\\\|Master Data\\\" /dev-server/src/components/layout/AppSidebar.tsx | head -20\", \"user_facing_description\": \"Locate sidebar insertion point\"}">
</lov-tool-use>
I have enough context. Tables `products` and `orders` already exist. Customers exists. There's already a POS Order History page. I'll plan a non-breaking "Transactions" sidebar group with three list-view-style pages reusing the existing tables.

<lov-plan>

# Plan: Add "Transactions" Sidebar Module (Customers / Products / Orders)

## What exists already
- `customers` table — 1,000 records (with names, birthdays, etc.)
- `products` table — schema exists (id, name, category, price, sku, brand, stock_qty, created_at, …) — likely empty or sparse
- `orders` + `order_items` tables — schema exists with `customer_id`, `order_number`, `total_amount`, `status`, `created_at`
- List View module already supports Customers/Orders/Products entities

So no schema changes are needed — we reuse existing tables to avoid breaking POS, List Views, and Journey Builder.

## 1. Sidebar — new "Transactions" group

`src/components/layout/AppSidebar.tsx` — insert a new `NavItem` (icon: `Receipt` from lucide). Position: just after **Point of Sale**. No reordering of any existing item.

```
Transactions  (icon: Receipt)
├── Customers   → /transactions/customers
├── Products    → /transactions/products
└── Orders      → /transactions/orders
```

`src/lib/modules.ts` — add three new module keys (`transactions`, `transactions.customers`, `transactions.products`, `transactions.orders`) + route map entries, so RBAC permission gating works.

## 2. Routes & pages

`src/App.tsx` — register three new routes inside the existing `AppLayout`/`ProtectedRoute` wrapper:
- `/transactions/customers` → `pages/transactions/CustomersList.tsx`
- `/transactions/products`  → `pages/transactions/ProductsList.tsx`
- `/transactions/orders`    → `pages/transactions/OrdersList.tsx`

Each page is a standalone, simple list view (sortable headers + pagination + search). They do **not** modify or reuse the POS pages (`/pos/products`, `/pos/orders`) — those continue to function unchanged.

### Page contents
- **CustomersList** — reads `customers`, columns: Name, Phone, Email, Tier, Segment, Total Orders, Total Spent (₹ en-IN), DOB, Anniversary. Drill-down row click optional (none for v1).
- **ProductsList** — reads `products`, columns: SKU, Name, Category, Brand, Price (₹), Stock Qty, Created At.
- **OrdersList** — reads `orders` joined with `customers(name)`, columns: Order #, Customer, Status, Payment Status, Total (₹), Date.

UI: `Card` + `Table` from existing shadcn components, `Pagination` (50 per page), text search input filtering name/order_number — same patterns as `ListViewsList.tsx` for consistency.

## 3. Sample data

Use the **insert tool** (data-only operations, no migration).

### Products — 10 rows
Realistic jewellery items (matches existing customer aesthetic from earlier seed):
```
Gold Diamond Solitaire Ring         | Rings      | ₹  85,000 | SKU-RING-001
22K Gold Chain Necklace             | Necklaces  | ₹1,25,000 | SKU-NECK-002
Platinum Wedding Band               | Rings      | ₹  45,000 | SKU-RING-003
Diamond Tennis Bracelet             | Bracelets  | ₹1,75,000 | SKU-BRAC-004
Pearl Drop Earrings                 | Earrings   | ₹  18,500 | SKU-EAR-005
Loose Diamond 0.5ct VVS             | Diamonds   | ₹2,00,000 | SKU-DIA-006
Rose Gold Pendant Set               | Necklaces  | ₹  32,000 | SKU-NECK-007
Kundan Bridal Choker                | Necklaces  | ₹1,50,000 | SKU-NECK-008
Silver Anklet Pair                  | Anklets    | ₹   5,500 | SKU-ANKLT-009
Gold Engagement Ring                | Rings      | ₹  65,000 | SKU-RING-010
```
Inserted only if `products` is empty (or with `ON CONFLICT (sku) DO NOTHING`) to avoid disturbing any existing POS products.

### Orders — 80 rows
For each: pick a random `customer_id` from `customers`, pick a random product, quantity 1–5, `total_amount = price * qty`, `created_at` spread across the past 6–12 months, status weighted (`completed` 70%, `pending` 20%, `cancelled` 10%). Generated with a single SQL `INSERT … SELECT FROM generate_series(1,80) …`. Will also insert matching `order_items` rows for relational consistency.

Since the `update_customer_stats` trigger fires on `status='completed'`, customer `total_orders` / `total_spent` will auto-update for the 80 new completed orders — the "computed total order value" enhancement is satisfied automatically.

## 4. APIs / data access

No new backend endpoints — all reads use the Supabase JS client directly from the page components (same pattern used everywhere else in the app, e.g. `ListViewsList`, `Employees`, etc.). This satisfies "GET products / GET orders" via PostgREST, with existing RLS.

## 5. RBAC

New module keys default to admin-accessible; sidebar rendering already gates by `usePermissions`. No changes to existing permission sets.

## Files Touched

**Edited (3):**
- `src/components/layout/AppSidebar.tsx` — add Transactions nav group
- `src/lib/modules.ts` — register new module keys + route map
- `src/App.tsx` — register 3 new routes

**New (3):**
- `src/pages/transactions/CustomersList.tsx`
- `src/pages/transactions/ProductsList.tsx`
- `src/pages/transactions/OrdersList.tsx`

**Data inserts (no migration):**
- 10 products (`ON CONFLICT (sku) DO NOTHING`)
- 80 orders + matching order_items

## Non-breaking guarantees

- `customers` schema untouched — just read
- `products` / `orders` schemas untouched — only inserts
- POS pages (`/pos/products`, `/pos/orders`) continue to work on the same tables
- List View entities + Journey Builder unchanged (they already point at these tables, and now have richer data to work with)
- New audit improvement: customer `total_spent` / `total_orders` get more realistic values via existing trigger — improves Journey Builder segmentation immediately

