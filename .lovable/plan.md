The detail page query uses `.or("handle.eq.<slug>,id.eq.<slug>")`. When the URL param is a slug like `mystic-veil-diamond-earrings`, the `id.eq.<slug>` clause is invalid because `id` is a UUID column — PostgREST rejects the whole OR filter and returns an error, so `maybeSingle()` yields `null` → "Product not found".

## Fix
In `src/pages/pos/CatalogItemDetail.tsx`, detect whether the route param is a UUID and query accordingly:
- If it matches a UUID regex → query `.eq("id", handle)`.
- Otherwise → query `.eq("handle", handle)`.

Also surface the query error in a small red message instead of silently showing "Product not found" so future issues are easier to diagnose.

No schema or business-logic changes.