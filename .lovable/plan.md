## Goal
Create a Deno/TypeScript edge function `export-trayi-tables` that reads six `trayi_*` tables from the external backup project (ylvhhlykyojudldcmzou), builds CSVs, zips them in-memory, and emails the ZIP to Abhishek.S@kvpcorp.com via Resend. No scheduler, no invocation UI (per your instruction).

## Where it lives
Deployed in **this** Lovable project (edge functions can't be pushed into the external project). It reaches the external project over HTTPS using a service-role key stored as a secret here.

## Steps

1. **Connect Resend** via the standard connector so `RESEND_API_KEY` is injected as an env var. (You'll pick the connection when prompted.)
2. **Request a new secret** `EXTERNAL_BACKUP_SERVICE_KEY` — the service-role key of project `ylvhhlykyojudldcmzou`. Required to read `trayi_*` rows past RLS.
3. **Create** `supabase/functions/export-trayi-tables/index.ts` with these helpers:
   - `fetchTable(name)` — paginated read (1000 rows/page) from `https://ylvhhlykyojudldcmzou.supabase.co/rest/v1/{name}` using `EXTERNAL_BACKUP_SERVICE_KEY`.
   - `convertToCSV(rows)` — RFC-4180 CSV with header row from union of keys; escapes `"`, commas, newlines; JSON-stringifies objects/arrays; ISO for dates; empty string for null/undefined.
   - `createZip(files)` — in-memory ZIP via `jsr:@zip-js/zip-js` (Deno-native, no filesystem), returns `Uint8Array`.
   - `sendEmail(zipBytes, filename)` — Resend `POST /emails` through the connector gateway; attaches the ZIP (base64) to `Abhishek.S@kvpcorp.com`; from address configurable via `EXPORT_FROM_EMAIL` env (default `onboarding@resend.dev` for initial test).
   - `Deno.serve` handler: CORS preflight, run all six tables in parallel, zip as `trayi_export_YYYY-MM-DD.zip`, call `sendEmail`, and return the raw ZIP bytes (`application/zip`) in the HTTP response body so the same call both emails and returns it.
4. **Tables**: `trayi_customers`, `trayi_inventory_items`, `trayi_order_items`, `trayi_orders`, `trayi_profiles`, `trayi_user_roles_master`.
5. **No changes** to order flow or any other project code.

## Technical notes
- Env vars used: `EXTERNAL_BACKUP_SERVICE_KEY`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, optional `EXPORT_FROM_EMAIL`. All read via `Deno.env.get`; nothing hardcoded.
- Resend attachment size limit is ~40 MB base64-encoded; current row counts (≤ ~400 rows total across the six tables today) are far under this, so a single email is fine.
- Function will be deployable/testable via `supabase.functions.invoke('export-trayi-tables')` or curl once you're ready (you said you'll wire invocation later).
- `verify_jwt` stays at Lovable default; no config.toml edits needed.

## Deliverable
One new file: `supabase/functions/export-trayi-tables/index.ts`. Plus two prerequisite actions (Resend connect + `EXTERNAL_BACKUP_SERVICE_KEY` secret) that I'll trigger in the same build turn.