## Sales Return (with Exchange Purchase)

A new transaction type mirroring the Sales Invoice page, where returned jewellery is received back into stock and must be exchanged for equal or higher value.

### 1. Database

New/extended tables (single migration):

- Extend `returns` with: `return_type` ('exchange'), `exchange_order_id` (new sales order), `return_value`, `new_purchase_value`, `additional_amount`, `created_by_user`. Relax `refund_method`/`refund_amount` defaults so cash-refund columns stay zero.
- Extend `return_items` with the frozen snapshot from the original invoice: `item_id` (inventory item), `sku` (LL Code), `category`, `gross_wt`, `net_wt`, `stone_wt`, `purity`, `metal_rate`, `making_charges`, `dia_price`, `cs_price`, `tax_amount`, `original_selling_price`.
- Add `inventory_status` to `inventory_items` (`available` | `sold` | `returned`), defaulting to `available`, and add `inventory_status_history` (item_id, from_status, to_status, reference_type, reference_id, changed_by, changed_at) so each SKU keeps the Created → Sold → Returned → Available → Sold Again trail.
- Triggers to append history rows automatically on status change; existing sale flow sets `sold`, return flow sets `available`.
- GRANTs + RLS on every new table for `authenticated` (and `service_role`), matching existing transaction tables.
- A `process_sales_return(...)` Postgres function (SECURITY DEFINER) performing everything atomically: create return record, return items, +1 `stock_ledger` rows (`transaction_type = 'sales_return'`), flip inventory status to available, create the exchange sales order + order items (via existing order flow shape) with `-1` ledger rows for the newly purchased pieces, record payment for the difference, and re-validate the business rule server-side.

### 2. New page `/transactions/returns`

Same layout, header, search/list-view bar, table styling and pagination as `OrdersList.tsx`: a list of past sales returns (Return #, Customer, Original Invoice, Return Value, Purchase Value, Additional Paid, Date, actions) plus a **New Sales Return** button.

### 3. Sales Return dialog (sectioned, like the New Sale modal)

1. **Customer** — same searchable customer select plus the existing "Create customer" button.
2. **Original Invoice** — lists that customer's completed orders; selecting one loads its line items.
3. **Returned Items** — checkbox table, read-only columns: LL Code (SKU), Product, Category, Gross Wt, Net Wt, Stone Wt, Purity, Metal Rate, Making Charges, GST, Original Selling Price. All values read from the saved `order_items` snapshot (falling back to the linked inventory item for weights/purity).
4. **New Purchase** — the exact product-picker/line-item grid from the Sales Order form (auto price calculation from gold/diamond/CS/making rates, manual price override, discounts, per-item tax master) reused as a shared component rather than duplicated.
5. **Payment Difference** — payable = New Purchase Value − Return Value. Existing payment method controls appear only when payable > 0.
6. **Transaction Summary** — Return Value, New Purchase Value, Additional Amount Payable, with a red inline error and disabled Save when purchase < return: "The purchase value must be greater than or equal to the return value. Cash refunds and store credit are not supported."

### 4. Reuse strategy

`OrderFormDialog.tsx`'s line-item logic is extracted into a shared hook/component (`useOrderLineItems` + `OrderLineItemsSection`) used by both the New Sale modal and the return's New Purchase section, so pricing, tax and override behaviour stay identical and single-sourced. Existing Sales Order behaviour is unchanged.

### 5. Inventory behaviour

No new inventory rows are ever created. The returned SKU's existing record flips to `available` and gets a `+1` ledger entry, immediately making it selectable in the normal Sales Order product dropdown. All ledger and status-history rows are additive.

### 6. Reporting & permissions

- New module key `transactions.returns` in `src/lib/modules.ts` + route map, exposed in the Permission Set screen and sidebar under Transactions, with the same permission semantics as Orders.
- Returns are stored separately from orders (`returns` table) so they never mix into the existing Sales Order report; the exchange order carries `order_type = 'exchange'`. Data shape supports later reports on Sales Returns, Exchange Transactions, Returned Item Value, Additional Amount Collected and Returned Inventory.

### Technical notes

- Route registered in `src/App.tsx` with `lazyWithRetry`, wrapped in the same protected layout.
- All writes go through the single `process_sales_return` RPC so a failure at any step rolls back inventory, return, order and payment together.
- Client-side validation mirrors the server rule; the server remains the enforcement point.
