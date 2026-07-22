## Goal

Introduce a **Tax Master** module under Admin → Master Data, mirroring the Quickapp reference. Seed a default **3% GST (1.5% CGST + 1.5% SGST, HSN 71131930)** slab that is marked default, auto-attached to every existing inventory item and every newly created item, and used to compute taxes in the New Order modal (replacing the current invoice-template SGST/CGST fallback).

## Database (migration)

New tables in `public`, all with GRANTs + RLS (authenticated read/write, service_role all):

- `tax_masters` — `id`, `name`, `tax_type` (default `GST`), `description`, `hsn_code`, `is_active`, `is_default` (bool, only one true), `apply_to_primary_orders`, `apply_to_secondary_orders`, `effective_from`, `effective_to`, `version`, `cloned_from_id`, `total_rate` (generated/maintained), timestamps.
- `tax_components` — `id`, `tax_master_id` FK, `component_type` enum (`CGST|SGST|IGST|CESS`), `percentage`, `is_enabled`, timestamps. Unique(tax_master_id, component_type).
- Add column `tax_master_id uuid` on `public.inventory_items` (FK to tax_masters, nullable).
- Partial unique index to enforce a single default: `CREATE UNIQUE INDEX ... ON tax_masters (is_default) WHERE is_default`.

Seed migration:
- Insert **"3% GST"** row with `hsn_code = 71131930`, description "Articles of jewelry and parts, gold set with diamonds", `is_active=true`, `is_default=true`, primary+secondary true, components CGST 1.5% + SGST 1.5% enabled (IGST/CESS disabled).
- Backfill: `UPDATE inventory_items SET tax_master_id = <3% GST id> WHERE tax_master_id IS NULL`.

Trigger on `inventory_items` BEFORE INSERT: if `tax_master_id` is null, set it to the current default tax master.

## Frontend

### Routing / navigation
- Add `src/pages/admin/TaxMaster.tsx` and route `/admin/tax-master`.
- Add module keys `admin.tax-master` in `src/lib/modules.ts` and `routeToModuleKey`.
- Insert **Tax Master** entry in the Admin → Master Data subsection in `AppSidebar.tsx`.

### Tax Master page (adapted from Quickapp reference UI)
- Header: "Tax Master" + subtitle "Configure GST/IGST tax rates and map to products" + **Create Tax** button.
- List of slab cards showing: name, Active/Default badges, tax type chip, HSN code chip, component breakdown (CGST/SGST/IGST/CESS %), Total %, Primary/Secondary applicability ticks, and count of linked items.
- Row actions: expand (inline products panel with search + bulk move to another slab), edit (pencil), clone (copy).
- **Create/Edit dialog** matching the uploaded screenshot: Tax Name, Tax Type (GST/IGST/Other), Description, HSN Code, Effective From/To, Tax Components (CGST/SGST/IGST/CESS with enable toggle + %), Active toggle, Applies to Primary/Secondary orders, "Set as default" toggle (setting one clears others via migration trigger or update logic).
- Expanded panel per slab: searchable, paginated list of `inventory_items` currently in that slab with a checkbox column (tick already shown for members), plus bulk-move dropdown to reassign.

### New Order integration (`OrderFormDialog.tsx`)
- Fetch each cart item's `tax_master_id` → resolve to components.
- Use the assigned slab's enabled components to compute SGST/CGST/IGST per line, then aggregate. Fall back to the default slab if an item has no slab.
- Replace the current `invoice_template.sgst_rate/cgst_rate` calculation. Keep invoice template rates only as legacy display fallback when no slab resolves.
- Line-level breakdown remains; totals show each component with its resolved rate (e.g. "CGST (1.5%)", "SGST (1.5%)").

### Inventory Items
- Show tax slab as a compact chip on each row (read-only for now). Editing the assignment happens from the Tax Master page's expand panel.

## Out of scope for this iteration
- No changes to invoice PDF layout — it already reads `sgst_rate`/`cgst_rate`; we'll pass resolved slab rates into the same fields for the printed invoice so no template edits are needed.
- Reports page tax columns keep pulling from stored `tax_amount` on orders.

## Acceptance
- `/admin/tax-master` renders with the 3% GST slab active + default, HSN 71131930, showing all inventory items ticked under it.
- Creating a new inventory item auto-assigns it to the default slab.
- New Order totals use 1.5% CGST + 1.5% SGST resolved from the slab, not from the invoice template.
- Additional slabs can be created; moving items across slabs updates linkage and future orders use the new rates.
