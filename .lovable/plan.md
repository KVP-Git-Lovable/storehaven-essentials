# Colour-aware product image on Catalog product page

## Goal
On the catalog product page, selecting a metal colour (Yellow / Rose / White Gold) should switch the displayed image to that colour's photo, derived from the colour code in the image filename (`_Y1`, `_R1`, `_W1`).

## Current state (verified)
- `catalog_products` stores a single `image_url` per product — no per-variant image column and no image array.
- Filenames follow `<SKU>_<colourcode><n>.jpg`, e.g. `DER001134_W1.jpg`, `DBR000467_Y1.jpg`. Some rows carry an extra suffix, e.g. `DER000411_W1_62ca219c-....jpg`.
- The detail page renders `product.image_url` directly, so the image never changes with the colour selection.

## Approach
1. Add a helper in `src/lib/catalogOptions.ts`:
   - `COLOR_CODE`: Yellow Gold to `Y`, Rose Gold to `R`, White Gold to `W`.
   - `imageUrlForColor(url, color)`: finds the `_[YRW]<digit>` token in the filename and rewrites only its letter, keeping the digit, any trailing suffix, the extension and the `?v=` query intact. Returns the original URL when no colour token is present or the colour is unknown.
2. In `src/pages/pos/CatalogItemDetail.tsx`:
   - Compute the displayed image from the currently selected Color option via the helper.
   - Prefer a variant-level image field if the matched variant has one; otherwise use the derived URL.
   - Add an error fallback on the image that reverts to the product's original `image_url`, so products whose alternate-colour file does not exist (notably rows with an extra UUID suffix) still show an image instead of a broken one.

## Out of scope
No changes to price, karat, variant matching, options parsing, import logic, or the catalog grid cards.

## Technical notes
- The regex targets the last `_[YRWyrw]<digit>` occurrence before the extension, so letters inside the SKU are never touched.
- Purely client-side derivation; no database or import changes.
