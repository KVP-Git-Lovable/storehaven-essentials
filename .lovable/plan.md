## Goal

Have the Trayi Lumina `/collections` page display live products from **this** project's `catalog_products` table (the same data shown at `/pos/catalog`), while keeping Lumina's existing luxury look and feel.

## Important: cross-project direction

Lovable's cross-project tools are read-only from *other → current*. I cannot edit the Trayi Lumina project from this project. So the plan splits into:

- **Part A — done here** (I can implement): expose the catalog as a public, read-only endpoint.
- **Part B — you (or I, from inside Trayi Lumina) do there**: swap Lumina's hardcoded `src/lib/catalog.ts` for a fetch against this project.

Nothing in `/pos/catalog`, its import flow, RLS for authenticated users, or any existing Lumina page/route is modified.

---

## Part A — In this project (StoreHaven)

1. **Add public read access to `catalog_products`.**
   Today only `authenticated` has SELECT. Add one anon-read policy + grant, scoped to active rows only:
   ```sql
   GRANT SELECT ON public.catalog_products TO anon;
   CREATE POLICY "Public can view active catalog"
     ON public.catalog_products FOR SELECT TO anon
     USING (status = 'active');
   ```
   No change to insert/update/delete policies. Import, edit, delete continue to require auth exactly as today.

2. **Give Lumina the connection values** (safe to share — publishable anon key):
   - `SUPABASE_URL`: `https://pdtasnfsdnfttayxibqy.supabase.co`
   - `SUPABASE_ANON_KEY`: the publishable key already in this project's `.env`
   - Table: `catalog_products`, active-only, columns: `id, title, handle, vendor, product_type, image_url, display_price, base_price, compare_at_price, options, variants, description`.

3. **Category mapping reference** (Lumina slugs ← this project's `product_type`):
   `rings ← Rings`, `earrings ← Earrings`, `pendants ← Pendants / Necklaces`, `bracelets ← Bracelets`, `bridal ← Bridal`. Anything not mapped falls under "All".

---

## Part B — In the Trayi Lumina project (applied there, not here)

Structure mirrors the existing `/collections` index + `/collections/$category` + `/product/$productId` pages. Look-and-feel stays Lumina's: `font-display`, `eyebrow`, hairline dividers, black/accent button pattern, `formatINR`, `ProductCard`, `SiteHeader`/`SiteFooter`, breadcrumb + spec table layout — none of that CSS or typography changes.

1. **New client** `src/lib/supabase.ts` — thin `@supabase/supabase-js` client using the two env values above (added as Vite env vars in Lumina).

2. **New data module** `src/lib/remoteCatalog.ts`:
   - `fetchCategories()` — `select distinct product_type` → maps to Lumina's `Category` shape (slug, name, tagline default, image = first product image in that type, or a placeholder).
   - `fetchProducts(category?)` — returns rows mapped to Lumina's `Product` shape:
     - `id ← handle ?? id`
     - `name ← title`
     - `sku ← first variant.variant_id`
     - `price ← base_price`, `mrp ← compare_at_price`
     - `metalOptions ← options.Color ?? []`
     - `purityOptions ← options.Purity ?? ["14 KT","18 KT"]`
     - `sizes ← options.Size` (with `sizeLabel` inferred from category)
     - `image ← image_url`, `gallery ← [image_url]`
     - `description ← description` (HTML stripped for card blurb)
     - `carats / weightGm / diamondCt` ← `null` when not present; UI already tolerates missing extras (only shown on PDP).
   - `fetchProduct(handle)` — single row lookup by `handle`, falls back to `id`.

3. **Rewire the three existing routes only** (no visual redesign):
   - `src/routes/collections.index.tsx` — replace `categories` import with a TanStack Router `loader` calling `fetchCategories()`. Same JSX, same eyebrow/hero/grid.
   - `src/routes/collections.$category.tsx` — loader now calls `fetchProducts(params.category)` and looks the category up remotely. Same hero + `ProductCard` grid.
   - `src/routes/product.$productId.tsx` — loader calls `fetchProduct(params.productId)`. Same gallery, purity/metal/size chips, price block, spec table, related-products section (related = `fetchProducts(product.category)` minus self, sliced to 4).

4. **Delete nothing.** `src/lib/catalog.ts` can stay untouched as a fallback or be removed later; the three routes stop importing from it.

5. **Cart, checkout, wishlist, header/footer, education, about, order-confirmation** — untouched. `useCart` keeps working because the mapped `Product` shape is identical to today.

## Technical notes

- Anon key is a publishable JWT; safe in Lumina's client bundle. RLS + the `status='active'` policy are what actually gate access.
- No edge function needed — direct PostgREST from Lumina.
- If Lumina later needs images cached/optimised, we can add a Supabase Storage or CDN step; not required for this plan.
- Once Part A ships, I can execute Part B for you if you switch me into the Trayi Lumina project (I can't edit it from here).

## Out of scope

- No changes to `/pos/catalog` UI or import.
- No changes to Lumina's design tokens, fonts, header/footer, cart, or checkout.
- No new admin surface — Lumina is read-only against the catalog.
