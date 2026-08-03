## What happened (confirmed from the database)

- All **750** catalog rows currently have `base_price`, `compare_at_price` and `display_price` empty, `options = {}` and `variants = []`.
- Every row's `updated_at` is `2026-08-03 05:58:18`, including the 9 products created on 2026-07-23. The last import therefore rewrote **every** existing product, not just new ones.
- Root cause is in the import dialog:
  1. It reads prices only from headers named exactly `Variant Price` / `Price`, and variants/options only from `Option1..3 Name` + `Option1..3 Value`. If the uploaded sheet uses different header names, these come out empty.
  2. It then calls `upsert(..., { onConflict: "handle" })` with the full row, so those empty values overwrote the good data on existing handles.
- Because prices and options are gone, the detail page shows no price and no karat/colour selector, and the grid shows no price — matching your screenshots.

## Fix plan

**1. Map the real file columns (needs the CSV/XLSX attached)**
Read the actual header row of your export, then build an explicit header-alias map covering price (`Variant Price`, `Price`, `MRP`, `Selling Price`, …), compare-at, SKU, and the option columns that carry karat/purity/metal colour/size. Header matching becomes case- and space-insensitive.

**2. Make the import non-destructive**
- Build each product row, then strip any key whose value is empty/null/`{}`/`[]` before upserting, so a missing column in the file can never blank existing data.
- Show a pre-import summary (products found, how many have prices, how many have variants/options, and any unmapped columns) with a Confirm step, so a bad mapping is visible before anything is written.

**3. Restore the wiped data**
Re-run the corrected import with your original file(s) to repopulate `base_price`, `compare_at_price`, `display_price`, `options` and `variants` for all 750 products, including the original 9.

**4. Karat / metal handling**
Normalise option names so `Karat`, `Purity`, `Metal`, `Metal Colour`, `Gold Purity` etc. land in consistent keys, and render karat as selectable chips (with per-variant price switching) on the product detail page.

**5. Catalog filters (new)**
Add a filter bar above the product grid on `/pos/catalog`:
- **Price range slider** bounded by the min/max `base_price` in the catalog.
- **Karat** checkboxes (e.g. 14K / 18K / 22K) derived from product options.
- **Metal colour** checkboxes (Yellow / Rose / White Gold) derived from options.
- Filters combine with the existing category tabs and search; a "Clear filters" reset and live result count.

## Technical notes

- Files touched: `src/components/pos/CatalogImportDialog.tsx` (header aliasing, sparse upsert, preview step), `src/pages/pos/CatalogMaster.tsx` (filter bar + filtering logic), `src/pages/pos/CatalogItemDetail.tsx` (karat/metal option rendering, variant price match).
- New component: `src/components/pos/CatalogFilters.tsx`.
- No schema change is required — `options` and `variants` are already `jsonb` on `catalog_products`.

**Next step:** attach the CSV/XLSX you imported (and the earlier one for the original 9 if available) so the column mapping is built from the real headers rather than guessed.
