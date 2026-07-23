# External Backup Mirror (Write-Only)

Mirror rows from this project to the external Supabase project `ylvhhlykyojudldcmzou` for six objects:
`customers`, `orders`, `order_items`, `inventory_items`, `profiles` (Users), `user_roles_master` (User Roles).

Zero changes to existing app logic — replication runs at the database layer via triggers, so every insert/update from the UI, edge functions, imports, or admin tools is captured automatically.

## Approach

Use Postgres `AFTER INSERT OR UPDATE` triggers on the 6 tables in this project. Each trigger uses the `pg_net` extension to fire an async HTTPS `POST` to the external project's PostgREST endpoint (`/rest/v1/<table>`) with header `Prefer: resolution=merge-duplicates` so it acts as an idempotent upsert on the primary key.

- Fire-and-forget (async) — never blocks or fails the original write.
- Write-only — no reads back, no FK enforcement on the external side (mirror tables have no FKs).
- Failures are logged in `net._http_response`; a lightweight `backup_mirror_failures` table captures errors for visibility. No auto-retry logic in v1 (kept minimal per "purely additive").
- Deletes are NOT mirrored (matches "backup copy" intent — external retains historical rows). Can be added later if you want.

## What's needed from you

The external project's **service role key** (from its Supabase dashboard → Project Settings → API). I'll store it as a secret named `BACKUP_MIRROR_SERVICE_KEY`. The external URL is public and hardcoded.

## Steps in this project

1. Enable `pg_net` extension (if not already).
2. Create a small `public.backup_mirror_config` table holding the external URL and (a reference to) the service key, plus a `backup_mirror_failures` log table.
3. Create a `SECURITY DEFINER` function `public.mirror_row(table_name text, row jsonb)` that:
   - Reads config, builds URL `https://ylvhhlykyojudldcmzou.supabase.co/rest/v1/<table>`.
   - Calls `net.http_post` with headers `apikey`, `Authorization: Bearer <key>`, `Content-Type: application/json`, `Prefer: resolution=merge-duplicates,return=minimal`, body = the row JSON (filtered to columns that exist on the mirror side).
4. Create 6 `AFTER INSERT OR UPDATE` triggers, one per table, that call `mirror_row` with `to_jsonb(NEW)` reduced to the mirrored column set.
5. One-time backfill: call `mirror_row` for every existing row in the 6 tables (batched, throttled) so the external project starts in sync.

## Steps in the external project

You (or I, if you paste the service key) run one migration on `ylvhhlykyojudldcmzou` that creates six standalone tables mirroring the columns below. Each has the same primary key (`id`) so upserts are idempotent. No RLS needed since only the service role writes; enable RLS with no policies to block anon reads if you prefer.

Mirrored columns (business fields only — skip volatile stats like `total_orders`, `total_spent` recalculated by triggers; keep them if you want an exact snapshot):

- **customers**: id, customer_code, phone, name, email, date_of_birth, anniversary_date, gender, city, state, country, tier, customer_segment, loyalty_points, store_credit, total_orders, total_spent, preferences, created_at, updated_at
- **orders**: id, order_number, store_id, customer_id, subtotal, discount_amount, tax_amount, total_amount, payment_method, payment_status, payment_reference, status, order_type, invoice_number, invoice_generated_at, coupon_id, coupon_discount, scheme_ids, loyalty_points_earned, loyalty_points_redeemed, gift_card_id, gift_card_amount, notes, created_by, created_at, updated_at
- **order_items**: id, order_id, item_id, quantity, unit_price, discount_percent, discount_amount, tax_percent, tax_amount, dia_price, cs_price, making_charges, total_amount, created_at
- **inventory_items**: all 48 columns (full mirror — this is the master catalog)
- **profiles** (Users): id, username, email, role_id, reports_to, status, must_reset_password, created_at, updated_at (excludes any theme/preference JSON unless you want it)
- **user_roles_master**: id, name, description, status, created_at, updated_at

Each mirror table has PK on `id` and no FKs (so parent/child arrival order doesn't matter).

## Failure handling

- pg_net responses land in `net._http_response`. A scheduled function (optional, v2) can scan for non-2xx and copy failed row IDs into `backup_mirror_failures` for reprocessing.
- v1 keeps it minimal: manual re-run of the backfill function will re-upsert everything.

## Not included (per your constraint)

- No changes to any existing table, RLS policy, edge function, or UI.
- No delete mirroring.
- No two-way sync — external is strictly a write target.

## Open questions

1. Do you want `profiles` theme/preference columns mirrored too, or just identity fields?
2. Should deletes be mirrored (soft-delete flag on external side), or keep external as append-only history?
3. OK to run the one-time backfill immediately after the triggers are in place?

Once you confirm and share the external service role key (I'll request it via the secure secret form), I'll run the migrations on both projects.
