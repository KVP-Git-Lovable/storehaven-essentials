## Plan

Three small, focused fixes.

### 1. Customers list — restore full default columns for "All records"

In `src/pages/transactions/CustomersList.tsx`:
- The current `DEFAULT_COLUMNS` array is missing `loyalty_points` and `store_credit` and other columns that were originally visible. Restore the original default column set so when **All records** is selected, the table shows the same columns it did before list-view support was added.
- Restored default columns: `name`, `phone`, `email`, `tier`, `total_orders`, `total_spent`, `loyalty_points`, `store_credit`, `created_at`, `date_of_birth`, `anniversary_date`.
- The Actions column (View / Edit / Delete icons) is already always rendered — confirm it stays visible regardless of view.
- Custom user-created list views continue to honor only their `selected_fields` / `column_order` (current behavior, unchanged).

### 2. Customer "View" dialog — show all orders of the customer

In `src/components/transactions/CustomerFormDialog.tsx`:
- When `mode === "view"` and a customer is loaded, add a new "Orders" section below the existing customer detail fields.
- Query `orders` table filtered by `customer_id = customer.id`, ordered by `created_at desc`, joined with `order_items(quantity, products:item_id(name))` to show item summaries.
- Render as a compact table with columns: Order # / Date / Items / Status / Total. Empty state: "No orders yet."
- Section is hidden in create/edit modes.

### 3. WhatsApp Customer Insights — relabel and use customer totals

In `src/pages/communication/WhatsAppConversations.tsx` (insights query around lines 221–253 and the card around lines 484–502):
- Replace the current WhatsApp-only metrics with the customer's overall totals from the `customers` table:
  - `Orders via WhatsApp` → **Total Orders** = `customer.total_orders`
  - `Revenue` → **Total Revenue** = `customer.total_spent` (formatted as INR)
- Keep `Total messages` (whatsapp_messages count for that phone) and `Last interaction` as-is.
- Simplify the insights query: drop the `whatsapp_messages → orders` join logic; only fetch the `total_messages` count plus read `total_orders` / `total_spent` from `selectedConv.customer`.

### Files to edit
- `src/pages/transactions/CustomersList.tsx`
- `src/components/transactions/CustomerFormDialog.tsx`
- `src/pages/communication/WhatsAppConversations.tsx`

No DB migrations or edge function changes required.
