# Import Memo Inward — Inventory Items

Add an **Import Memo Inward** button on `/inventory/items` that accepts a CSV/XLSX in the attached Trayi Jewellers format and creates inventory item rows. All existing functionality (POS, WhatsApp, Journeys, Orders, GRN) stays untouched — this is purely additive.

## Import rules

- Only rows where **Item No** is non-blank are imported. Blank-Item-No rows in the sample are stone/size sub-rows for the previous item and are ignored (grouping of sub-rows into a single item is out of scope for v1).
- Field mapping per imported row:
  - `sku` = `barcode` = **Item No** (e.g. `LL-55998`)
  - `category` = the **Name** in Category Master (`/master/category`) whose name matches Excel's **Category** (case-insensitive). If no match, the row is skipped and reported in the import summary.
  - `name` (the "Item" field) = `Main Metal + " " + Category` (e.g. `18KT Earring`)
  - All other Excel columns are stored in new dedicated columns (see below).
- Duplicate handling: if `sku` already exists → **update** that row; otherwise **insert**. Reported separately in the summary.

## Data model (additive)

New nullable columns on `public.inventory_items` (one migration, no changes to existing columns):

| Column | Type | Source |
|---|---|---|
| `style_no` | text | Style No |
| `main_metal` | text | Main Metal |
| `product_size` | text | Product Size |
| `colour` | text | Colour |
| `gross_wt` | numeric | Gross Wt |
| `net_wt` | numeric | Net Wt |
| `total_diamond_wt` | numeric | Total Diamond Wt. |
| `total_colour_stone_wt` | numeric | Total Color Stone Wt. |
| `material_type` | text | Material Type |
| `material_quality` | text | Material Quality |
| `material_inter_quality` | text | Material Inter. Quality |
| `product_cert_no` | text | Product CERTNO |
| `product_cert_by` | text | Product Cert By |
| `rm_cert_by` | text | Rm Cert By |
| `rm_cert_no` | text | Rm Cert NO |
| `length` | numeric | Length |
| `material_weight` | numeric | Material Weight |
| `material_pcs` | integer | Material Pcs |
| `item_price` | numeric | Item Price (also copied to existing `selling_price`) |
| `p_amount` | numeric | P amount |
| `category_group` | text | Category Group |
| `material_rate` | numeric | material rate |

No new tables, no RLS/grant changes (existing policies on `inventory_items` already cover authenticated users).

## UI changes (scope = `/inventory/items` only)

1. **Import Memo Inward** button in the header (next to Add Item).
2. **Import dialog** — file picker (.csv, .xlsx), a downloadable sample template, and post-import summary: `Imported X · Updated Y · Skipped Z (reasons listed)`.
3. **Inventory Items table** — append the new jewellery columns after the existing ones so nothing existing shifts or is removed. Columns overflow horizontally via existing table scroll.
4. **Edit dialog** — add a collapsible "Memo / Jewellery details" section exposing the new fields so imported values can be reviewed/edited. Existing fields stay in place.

## Technical notes

- Parse CSV with PapaParse (already commonly used) and XLSX via `xlsx` if the file is `.xlsx`; add whichever isn't installed.
- All parsing/insert/update runs client-side against Supabase using the existing `inventory_items` policies — no edge function needed.
- Category matching uses `categories` table `name ILIKE excel_category`.
- `selling_price` on new rows = `item_price` (so POS/order flows keep working); `unit_cost` defaults to 0 unless already set on an update.
- `unit` defaults to `pcs`, `status` defaults to `active` on insert.

## Out of scope

- Merging multi-row (stone/size sub-row) items into one composite record.
- Any change to Products, POS, WhatsApp, Journey Builder, Orders, GRN, or other modules.
