## Overview

Turn `/pos/catalog` (currently a stub) into a Shopify-style catalog browser. It reads from a new `catalog_products` table, groups items into tabs by **Product Type**, renders **Title** + **Product Image** cards, and opens a detail page showing price, description, and Karat/Color/Size variants — styled in the existing app theme but laid out like the two reference screenshots. A second phase adds an **Import catalog** button that ingests the same Shopify-format CSV/XLSX.

Note about the source file: the uploaded `Limelight_products_in_copy_in.csv` contains 762 rows but only 9 have data (4 RING, 3 NECKLACE, 2 EARRING); the remaining 753 rows are blank and will be skipped by the importer. The 9 real products will be seeded on first load.

## Data model

New table `public.catalog_products`:
- `shopify_id` (text, unique) — the CSV `ID`
- `title`, `vendor`, `product_type`, `handle`, `description` (text)
- `image_url` (text) — from `Product Image`
- `display_price` (text) — the raw `Price` string, e.g. `34827.00 (Was 44839.00)`
- `base_price`, `compare_at_price` (numeric) — parsed from the above
- `published_at` (timestamptz)
- `tags` (text[])
- `options` (jsonb) — parsed `Options` column, e.g. `{ Purity: ["18 KT","14 KT","9 KT"], Color: [...], Size: [...] }`
- `variants` (jsonb) — parsed `Variants` column as an array of `{ purity, color, size, price, variant_id }`
- `status` (text, default `active`)
- `sort_order` (int, default 0)

Grants: `SELECT/INSERT/UPDATE/DELETE` to `authenticated`, `ALL` to `service_role`. RLS on, one policy: authenticated users can do everything (matches existing masters like `gold_rates`, `making_charges_rates`).

## UI — Catalog list (`/pos/catalog`)

Replaces the stub in `src/pages/pos/CatalogMaster.tsx`.

- Page header: "Catalog Master" title + right-aligned **Import catalog** button (phase 2 wires it up; phase 1 renders it disabled with a tooltip).
- **Product Type tabs** row directly under the header, styled to echo the reference screenshot (uppercase, letter-spaced, current tab underlined in the theme's primary color) using existing shadcn `Tabs`. Tabs are derived from `distinct product_type` in the table, ordered by count desc, with an "All" tab first. Types render exactly as stored (RING, NECKLACE, EARRING).
- Under the active tab: a section title (e.g. "Rings") in title case, then a responsive card grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`).
- Each card: square image from `image_url` with rounded corners and subtle border, title below in the theme's serif-style heading, price line (`₹ 34,827` with strikethrough compare-at when present, both parsed from `display_price`). If `Color` options exist, small color-dot chips render below the price (rose/yellow/white gold mapped to swatch colors).
- Card is clickable → navigates to `/pos/catalog/:handle`.
- Search input above the grid filters by title within the active tab.

## UI — Catalog item detail (`/pos/catalog/:handle`)

New page `src/pages/pos/CatalogItemDetail.tsx`, routed in `src/App.tsx`.

Two-column layout matching the second screenshot:
- **Left:** large product image with a small crumb link ("← back to {Product Type}") above it.
- **Right:**
  - Title (serif, large).
  - `SKU  {shopify_id}` and a stub Wishlist icon.
  - Price row: `₹ {base_price}` + strikethrough `₹ {compare_at}` when present, then `( Inclusive of all taxes )` muted line and the estimate disclaimer.
  - Description block (renders sanitized HTML from `description`).
  - **Purity** selector: pill buttons for each value in `options.Purity` (e.g. 18 KT / 14 KT / 9 KT). Selected pill uses `bg-primary text-primary-foreground`.
  - **Color** selector: circular swatches for each `options.Color` value, mapped rose/white/yellow → gradient/silver/gold fill.
  - **Size** selector (only when `options.Size` exists): dropdown or pill row.
  - Selected combination looks up the matching `variants` entry and updates the displayed price live.
  - Quantity stepper + **Add To Cart** (stub) and **Buy Now** (stub) buttons — visual only for this phase; no cart wiring.

Read-only page. No edits to POS order/cart logic.

## Import catalog (phase 2)

- **Import catalog** button opens `CatalogImportDialog.tsx` (patterned on the existing `MemoImportDialog`).
- Accepts `.csv` / `.xlsx`. Parses with `xlsx` (already in the project). Expected headers: `ID, Product Image, Title, Vendor, Published_at, Product Type, Price, Published Date, Handle, Tags, Options, Variants, Variant IDs, Description`.
- For each row: skip if `Title` and `ID` are both blank. Parse `Options` (semicolon-separated `Name: v1/v2/v3`) into the options JSON and `Variants` (semicolon-separated `v1 / v2 / v3: price`) into the variants JSON. Parse `Price` into `base_price` and `compare_at_price` via regex.
- Preview table with row-count and per-tab counts, then **Upsert** on `shopify_id` (insert new, update existing).
- Toast summary: X inserted, Y updated, Z skipped.

## Seeding

Phase 1 migration also inserts the 9 real products from the uploaded CSV so the page has content immediately. Phase 2 import then supersedes / adds more.

## Permissions & navigation

No changes — `pos.catalog` permission and sidebar entry already exist from the previous turn. The detail route `/pos/catalog/:handle` sits under the same permission.

## Out of scope

- No changes to POS ordering, cart, inventory items, or pricing configuration.
- Add To Cart / Buy Now / Wishlist buttons on the detail page are visual stubs only.
- No sync from `inventory_items` — catalog is its own table.

## Files touched

- `supabase/migrations/*` — new table, grants, RLS, seed 9 rows.
- `src/pages/pos/CatalogMaster.tsx` — rewrite from stub to tabs + grid + Import button.
- `src/pages/pos/CatalogItemDetail.tsx` — new detail page.
- `src/components/pos/CatalogImportDialog.tsx` — new import dialog (phase 2).
- `src/App.tsx` — add `/pos/catalog/:handle` route.
