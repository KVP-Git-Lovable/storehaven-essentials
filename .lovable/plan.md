## Goal
Add a third transaction type — **Old Gold Exchange** — at `/transactions/old-gold-exchange`, mirroring the existing Sales Return page/dialog/receipt patterns, where a customer's old/melted gold is valued by weight and purity and set off against a new jewellery purchase.

## Navigation
- Sidebar under **Transactions**: Orders → Sales Return → **Old Gold Exchange** (`/transactions/old-gold-exchange`), same module key `transactions.orders` so permissions match Sales Order / Sales Return.
- Route registered in `App.tsx` alongside `/transactions/returns`.

## Database (single migration)
Two new tables, kept separate from jewellery inventory so bullion/refining can build on them later:

- `old_gold_exchanges` — customer, exchange datetime, created-by user, total old gold value, total purchase value, additional amount paid, payment method, linked sales order (`order_id`), exchange number, status, notes, timestamps.
- `old_gold_exchange_items` — one row per old gold item: description, ornament type, gross weight, karat, measured purity %, fine gold weight, purchase rate, deductions, calculated value, remarks.

Both get GRANTs for `authenticated`/`service_role`, RLS enabled, and policies matching the existing `returns` / `return_items` access pattern.

A `process_old_gold_exchange(...)` SECURITY DEFINER function performs everything in one transaction: validates `new purchase value >= total old gold value`, creates the sales `order` + `order_items` (same shape as the Sales Return exchange order), writes `stock_ledger` sale rows for the purchased LL Codes, inserts the exchange header and its items, and returns the new ids/numbers. Any failure rolls the whole thing back. No LL Codes or inventory rows are created for old gold.

## New Old Gold Exchange dialog
Reuses `useOrderPricing` / `useOrderLineItems` / `OrderLineItemsSection` / `ManualPriceOverrideDialog` / `CustomerFormDialog` exactly as `SalesReturnDialog` does, so the jewellery-selection half is identical to a Sales Order (inventory search, LL Code, GST, making, diamond/CS pricing, discounts).

Sections top to bottom:
1. **Customer** — same searchable select + "Create customer" button.
2. **Old Gold Received** — repeatable rows: Description, Ornament Type (optional), Gross Wt (g), Karat, Measured Purity %, Purchase Rate (₹/g), Deductions (₹, optional), Remarks. Each row shows live `Fine Gold Wt = Gross × Purity/100` and `Value = Fine × Rate − Deductions`. Purchase Rate pre-fills from the configured daily old gold buy rate (the 24K buy price from Price Configuration, scaled by karat: 22K 91.6%, 18K 75%, 14K 58.5%) and stays editable.
3. **New Jewellery Purchase** — the existing Sales Order line items section, unchanged.
4. **Summary** — Total Old Gold Value, New Purchase Value, Additional Amount Payable (`purchase − old gold`), plus payment method shown only when the difference is above zero.

Save is disabled and a red inline message appears when purchase < old gold value: "The purchase value must be greater than or equal to the value of the old gold. Cash refunds, wallet balance and store credit are not supported." The same rule is re-checked server-side in the RPC.

## List page
`/transactions/old-gold-exchange` copies the `SalesReturnsList` layout: header + New button, search by exchange number, paginated table (Exchange #, Customer, Linked Order, Old Gold Value, Purchase Value, Additional Paid, Status, Date), and a Receipt icon per row.

## Receipt
New `OldGoldReceiptDialog`, built on the same 320px thermal print framework as `ExchangeReceiptDialog`: store details, receipt number, exchange date/time, customer, operator, an "Old Gold Received" block with each item's full valuation breakdown, a "New Jewellery Purchased" block (LL Code, product, qty, amount), then Total Old Gold Value / New Purchase Value / Additional Amount Paid / Payment Method and a thank-you line.

## Reporting readiness
Field names and the item-level split (gross wt, fine wt, purchase value, additional amount, linked order id) are chosen so future reports on exchanges, gold purchased, total gross/fine weight and collected amounts are plain aggregations — no schema change needed later.
