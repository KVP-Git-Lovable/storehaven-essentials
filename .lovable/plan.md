## Leads Module with Lead-to-Customer Conversion

Add a new "Leads" module under Transactions with full CRUD, conversion-into-customer flow via order creation, duplicate detection, and post-conversion UI states.

### 1. Database (migration)

Create `public.leads` table:
- `id` uuid PK default `gen_random_uuid()`
- `name` text
- `email` text
- `phone` text NOT NULL
- `city` text, `state` text, `country` text, `address` text
- `created_at` timestamptz default `now()`
- `updated_at` timestamptz default `now()`
- `is_converted` boolean default false
- `converted_at` timestamptz
- `converted_customer_id` uuid REFERENCES `customers(id)` ON DELETE SET NULL
- Index on `phone`, `email`, `is_converted`
- Enable RLS with policies mirroring `customers` (authenticated users can select/insert/update; only admins delete — match existing pattern).
- `updated_at` trigger using existing `update_updated_at_column()`.

### 2. Sidebar + Module Registration

- `src/lib/modules.ts`: Add module `transactions.leads` (parent: `transactions`) above `transactions.customers`. Add route mapping `/transactions/leads → transactions.leads`.
- `src/components/layout/AppSidebar.tsx`: In the Transactions group, insert `{ title: "Leads", href: "/transactions/leads", moduleKey: "transactions.leads" }` ABOVE Customers.
- `src/App.tsx`: Add lazy import `LeadsList` and route `/transactions/leads`.

### 3. Pages & Components

**`src/pages/transactions/LeadsList.tsx`** (new) — mirror `CustomersList.tsx` structure:
- Columns: Name, Email, Phone, City, State, Country, Address, Status, Actions
- Search box (all fields / by column), pagination (50/page)
- Top-right "New Lead" button → opens `LeadFormDialog`
- Row actions: View, Edit, Delete, **Convert** button
- Converted rows: apply `opacity-50 bg-muted/30` and replace Convert with disabled "Converted" badge + small link to view linked customer (opens `CustomerFormDialog` in view mode)
- Click row → opens View dialog (consistent with Customers)

**`src/components/transactions/LeadFormDialog.tsx`** (new) — analogous to `CustomerFormDialog`:
- Create / Edit / View modes
- Fields: name, email, phone (required), city, state, country, address
- In View mode for converted leads: show "Converted on {date}" and a button to open the linked customer.

**`src/components/transactions/LeadConvertDialog.tsx`** (new) — order-creation flow with prefilled customer:
- Opened via "Convert" button on a lead row.
- Step 1 (auto): Duplicate check — query `customers` by `phone` OR `email` (when present). If a match exists, show toast "Customer already exists" and offer two options:
  - "Link existing customer" — sets selected customer to the matched one (no new customer created), proceeds to order step
  - "Cancel"
- Step 2: If no duplicate, dialog shows prefilled (read-only) customer summary (name/email/phone/city) and an editable order form (reusing the same line-item UX as `OrderFormDialog`: product picker + quantity rows, status). Submit performs in sequence:
  1. `INSERT` into `customers` with lead data (tier default 'bronze')
  2. `INSERT` into `orders` with `customer_id` from step 1
  3. `INSERT` `order_items`
  4. `UPDATE` `leads` SET `is_converted=true, converted_at=now(), converted_customer_id=<new id>`
- On success: invalidate `transactions-leads` and `transactions-customers`, toast "Lead converted", close dialog.
- If "Link existing customer" path was used: skip step 1 and use the existing customer id; still mark the lead as converted with that id.

### 4. Conversion Constraints

- Convert button is hidden/disabled when `is_converted = true`.
- Leads are never deleted on conversion — only flagged.
- Existing Customers module code is untouched.

### 5. Files Touched

New:
- `supabase/migrations/<ts>_create_leads.sql`
- `src/pages/transactions/LeadsList.tsx`
- `src/components/transactions/LeadFormDialog.tsx`
- `src/components/transactions/LeadConvertDialog.tsx`

Edited:
- `src/App.tsx` (route + lazy import)
- `src/components/layout/AppSidebar.tsx` (menu entry)
- `src/lib/modules.ts` (module key + route mapping)

### Notes

- Reuse the existing line-item composition pattern from `OrderFormDialog` rather than navigating to a separate page, to keep the flow modal-based and consistent with the rest of Transactions.
- Duplicate check is case-insensitive (`ilike`) on phone and email.