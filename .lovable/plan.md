
Implement the order flow in two coordinated parts so the Orders page becomes the source of truth for what is shown in Customers.

## 1. Upgrade “New Order” to support multiple products
Update `src/components/transactions/OrderFormDialog.tsx` from a single-product form to a line-item order form.

### UI changes
- Keep one customer selector and one order status selector.
- Replace the single `productId` + `quantity` inputs with a repeatable line-items section:
  - Product selector
  - Quantity
  - Unit price preview
  - Line total
  - Remove row
- Add:
  - “Add Product” button
  - Order subtotal / tax / grand total summary
- Keep the existing modal pattern and sticky action footer.

### Save logic
On Create:
1. Validate customer is selected and at least one valid line item exists.
2. Calculate:
   - `subtotal` = sum of line totals
   - `tax_amount` = consistent value based on product tax if already stored, otherwise preserve existing simplified logic
   - `total_amount`
3. Insert one row in `orders`
4. Insert multiple rows in `order_items` for that order
5. Invalidate `transactions-orders` so `/transactions/orders` refreshes immediately

### Non-breaking detail
- Keep using `products` and `order_items` tables already in place
- Do not change schema
- Preserve current statuses (`completed`, `pending`, `cancelled`)

## 2. Make `/transactions/orders` reflect meaningful customer purchase data
Right now the table mixes:
- unwanted manual/system rows
- seed rows linked to only a few customers
- customer aggregate values (`total_orders`, `total_spent`) that do not match actual order rows

To fix this, rebuild the order dataset so it aligns with Customers.

### Data cleanup
Remove unwanted rows from `orders` and matching `order_items` for:
- rows with `created_by = 'System'`
- old seed rows that do not match the intended customer-based model
- any rows not meant for the Transactions module view

This is a data operation, not a schema change.

## 3. Reseed orders from customer purchase aggregates
Generate fresh `orders` + `order_items` records based on existing customer data.

### Rule
For each customer:
- create approximately `customers.total_orders` order rows
- distribute those rows so the sum of completed order totals is close to `customers.total_spent`
- spread dates realistically over recent months
- assign products from the existing `products` table
- create 1–N order items per order so totals look believable
- ensure no orphaned rows

### Recommended seeding model
For every customer with `total_orders > 0` and `total_spent > 0`:
- derive an average order value from `total_spent / total_orders`
- create multiple orders with randomized variation around that average
- distribute totals across selected products and quantities
- make most rows `completed`
- allow a small share of `pending` / `cancelled` only if they do not distort the customer totals shown in Customers

### Important consistency rule
After reseeding:
- `orders` page should reflect the customer purchase story
- `customers.total_orders` and `customers.total_spent` should match the rebuilt order history closely
- if needed, recompute customer aggregates from the new completed orders so Customers and Orders stay aligned

## 4. Improve `/transactions/orders` display
Update `src/pages/transactions/OrdersList.tsx` so the list remains clean and useful after reseeding.

### UI improvements
- Continue to read from `orders`
- Optionally add a compact item-count column using `order_items`
- Keep search, pagination, and list-view filtering intact
- Ensure newly created multi-product orders show up immediately after save

## 5. Files to update
### Edit
- `src/components/transactions/OrderFormDialog.tsx`
- `src/pages/transactions/OrdersList.tsx`

### Likely read/verify during implementation
- `src/pages/transactions/CustomersList.tsx`
- `src/integrations/supabase/types.ts`
- `src/lib/listViewExecutor.ts`

## 6. Data work required
Because this request includes deleting and rebuilding existing order records, implementation will include backend data operations:
- delete unwanted order/order_item rows
- insert rebuilt `orders`
- insert rebuilt `order_items`
- optionally update customer aggregates to match the rebuilt order history

## 7. Outcome
After implementation:
- “New Order” supports multiple products in one order
- clicking Create immediately adds the order to `/transactions/orders`
- unwanted legacy rows are removed
- Orders page becomes a believable transaction history derived from customer purchase totals
- Customers and Orders stay aligned instead of showing contradictory numbers
