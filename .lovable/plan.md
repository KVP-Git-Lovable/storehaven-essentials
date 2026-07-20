## Add Reports subsection under Transactions

### Navigation
- In `src/components/layout/AppSidebar.tsx`, add a new child under **Transactions** (below Orders):
  - `{ title: "Reports", href: "/transactions/reports", moduleKey: "transactions.orders" }`
- Register route `/transactions/reports` → new page `src/pages/transactions/Reports.tsx` in `src/App.tsx`.

### Reports page (`src/pages/transactions/Reports.tsx`)
Top toolbar with three controls (matching the analytics-style layout in screenshot 2):

1. **Report type dropdown** — default `Orders`. Options: `Orders`, `Customers`, `Leads`, `Products`. (Only Orders wired in this pass; others show "Coming soon" placeholder to keep scope tight.)
2. **Quick range dropdown** — Today, Yesterday, This Week, This Month, This Quarter, This FY (Apr–Mar), Last Week, Last Month, Last Quarter, Last FY, Last 60 Days, All Time.
3. **Custom From / To date pickers** — selecting either clears the quick range; picking a quick range clears custom dates. (Same either/or behavior shown in screenshot 2.)
4. **Refresh** button.
5. **Export** dropdown button on the right: Excel (.xlsx), CSV, PDF.

### Orders report content
Fetch `orders` in the selected date range (joined with `customers` and `order_items` + `inventory_items`), then render grouped rows in a table styled like the sample invoice register (screenshot 1):

Grouping: **by Customer**, sorted alphabetically. For each customer:
- One row per invoice line item with columns:
  - Invoice Date, Invoice #, Customer, Category, Item # (SKU), Gross Wt, Metal Wt (net_wt), Dia Wt, Dia Pcs, Quantity, Amount (subtotal-of-line pre-tax), Discount, Net Amount, Total Tax, Gross Amount (line total incl. tax)
- A **Total For {Customer}** row aggregating numeric columns.
- A grand total row at the bottom.

Header block above the table: company name + address from `useCompanyInfo`, and a subtitle "Sales INV Report – RT WITH TAX" with the selected date range.

Currency formatted `en-IN`. Weights to 3 decimals. Zeros shown as `0` / `0.000` (not dashes) to match the reference.

### Exports
- **CSV** — build from the same row set in-memory; `Blob` download.
- **Excel** — use existing `xlsx` package (already in project via memo import) to write a single sheet with header + grouped rows + totals.
- **PDF** — use `window.print()` on a print-scoped view of the report (reuses the `@media print` approach already used for invoices). Add a hidden print stylesheet in the page.

### Out of scope (explicit)
- No changes to Journey Builder, WhatsApp, Email, Order create/edit flows, or invoice generation.
- No new DB tables, migrations, or edge functions — pure read/aggregation on client from existing tables.

### Technical notes
- Reuse `useCompanyInfo`, `useInvoiceTemplate` for tax %.
- Date range helpers in a small local util inside the page file (no shared lib change).
- Query uses supabase select `orders(*, customers(name), order_items(quantity, unit_price, total_amount, dia_price, cs_price, making_charges, tax_amount, item_id, inventory_items(sku, main_metal, category, gross_wt, net_wt, total_diamond_wt, diamond_pieces)))` filtered by `created_at` between range, `status != 'cancelled'`.
