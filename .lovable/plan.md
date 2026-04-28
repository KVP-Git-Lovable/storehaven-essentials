## Goal

Add a "Leads" entity to the List Views system so users can:
1. Create / manage saved List Views on the Leads page (same UX as Customers / Orders / Products).
2. Use those Leads list views as audience sources in the Journey Builder, just like Customers list views.

## Changes

### 1. Register `leads` as a list-view entity

**`src/lib/listViewSchema.ts`**
- Add `"leads"` to `EntityKey`.
- Add a `leads` entry to `ENTITY_SCHEMAS` with:
  - `table: "leads"`, `isAudienceSource: true`, `contactKey: "phone"`
  - Fields: `id`, `name`, `phone`, `email`, `city`, `state`, `country`, `address`, `is_converted` (boolean), `converted_at` (date), `created_at` (date)

### 2. Mirror that registration in the backend resolvers

So saved Leads list views work for counts, previews, and journey enrollment.

**`supabase/functions/list-view-resolve/index.ts`**
- Add `leads: { table: "leads", isAudienceSource: true, contactKey: "phone" }` to `ALLOWED_ENTITIES`.

**`supabase/functions/_shared/journey-schedule.ts`**
- Add the same `leads` entry to its `ALLOWED_ENTITIES` map.
- In `resolveAudience` / count helpers, add a branch for `entity_type === "leads"`: treat each lead row like a customer row (use its `phone`, `name`, `email`, `city` to upsert into `journey_contacts` with `segment_type: "lead"`), reusing the existing `upsertContactsFromCustomers` helper (or a thin wrapper that maps lead rows to the same shape).

This makes a Leads list view enroll contacts into journeys exactly like a Customers list view does today.

### 3. Add the List Views bar to the Leads page

**`src/pages/transactions/LeadsList.tsx`**
- Import `EntityListViewsBar` (exported as `n`) from `src/components/transactions/EntityListViewsBar.tsx`, same way Customers / Orders / Products do.
- Add state: `activeViewId`, `viewFilters`, `viewSelectedFields`, `viewColumnOrder`.
- Render the bar above the table with `entity="leads"`.
- When a view is applied, run the query through `executeListView` (from `src/lib/listViewExecutor.ts`) instead of the current static `supabase.from("leads")...` query, so saved filters and selected fields take effect (mirroring CustomersList behavior).
- Keep the existing search box, pagination, Import Leads button, and row actions intact.

### 4. Expose Leads list views to Journey Builder

**`src/components/journey/AudienceBuilder.tsx`** (line 41)
- Change the filter from:
  ```
  v.entity_type === "customers" || v.entity_type === "orders"
  ```
  to also include `"leads"`. Saved Leads views will then appear in the Entry node's audience picker exactly like Customers views.

### 5. (No DB migration needed)

The `leads` table already exists with the right columns and RLS, and `list_views.entity_type` is a free text column (existing values include `customers`, `orders`, `products`), so no schema change is required.

## How the user will experience it

- On `/transactions/leads`: a new "List Views" bar appears at the top with the same dropdown / New / Edit / Duplicate / Delete controls used on Customers. They can build views like "Unconverted leads created in last 30 days" or "Leads in Bengaluru".
- In the Journey Builder Entry node's audience picker, those Leads views show up alongside Customers and Orders views and can be combined with the same union / intersection / difference logic.
- When a journey runs, leads matched by the view get enrolled by phone into `journey_contacts` (tagged `segment_type: "lead"`) and receive WhatsApp / SMS / Email messages just like customers.
