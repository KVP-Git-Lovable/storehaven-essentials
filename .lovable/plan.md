## Root cause (confirmed by reading the uploaded file)

The file's headers are fine — the *cell formats* are the problem.

- `Price` cell = `34827.00 (Was 44839.00)`. The importer's `toNumber` strips every non-digit, producing `34827.0044839.00`, which is `NaN` → price = null. Hence "0 With price".
- `Options` is a single packed cell: `Purity: 18 KT/14 KT/9 KT; Color: Rose Gold/White Gold/Yellow Gold; Size: 8/9/…` — the importer only understands `Option1 Name` / `Option1 Value` column pairs, so it ignores this (listed as "unmapped").
- `Variants` is a single packed cell: `18 KT / Rose Gold / 8: 34827.00; 18 KT / White Gold / 9: 44839.00; …` — also ignored, so 0 variants and no per-variant price switching.
- One row per product (no per-variant rows), so all pricing/variant data lives in these three packed strings.

## Fix

**1. Price parsing (`toNumber` + a dedicated price parser)**
Parse `"<price> (Was <compare>)"`: take the first numeric token as `base_price` and the value after `Was` / `MRP` / `was ₹` as `compare_at_price`. Keep handling plain numbers, `₹`, and thousands separators (`44,839.00`). Fix the generic number cleaner so multiple numbers in one cell can never concatenate into `NaN`.

**2. Packed `Options` column**
New parser: split on `;`, each part `Name: v1/v2/v3`. Run names through the existing `canonicalOptionName` (`Purity` → `Karat`, `Color` → `Color`, `Size`) and values through `normalizeOptionValue` (`18 KT` → `18K`, `Rose Gold` stays). Result populates `options`.

**3. Packed `Variants` column**
New parser: split on `;`, each part `<v1> / <v2> / <v3>: <price>`. Positionally map the values to the option names declared in the `Options` cell (falling back to inferring Karat/Color/Size by value shape when `Options` is absent), producing proper variant records `{ karat, color, size, price }`. `base_price` becomes the minimum variant price; `compare_at_price` the maximum where it exceeds it. If both the `Price` cell and `Variants` exist, the `Price` cell wins for the displayed base/compare pair.

**4. Preview accuracy**
`Options`, `Variants`, `Variant IDs`, `Published Date` stop being reported as unmapped, and the summary will show 9 with price / 9 with variants / 9 with options for this file. The "No prices were detected" warning stays as a guard for genuinely price-less files.

**5. Restore the wiped 750 products**
Re-run **Import catalog** with the full export after the fix; the non-destructive upsert already in place will refill `base_price`, `compare_at_price`, `display_price`, `options` and `variants`. The confirm screen will show the price count before anything is written.

## Technical notes

- Files touched: `src/components/pos/CatalogImportDialog.tsx` (price parser, packed-options parser, packed-variants parser, alias/unmapped bookkeeping), `src/lib/catalogOptions.ts` (accept `9 KT`, `18 KT` spacing variants; keep `Purity` → `Karat` mapping).
- No schema change — `options`/`variants` are already `jsonb`.
- The catalog filters and detail-page karat/colour chips already read these fields, so they light up automatically once the data is populated.
