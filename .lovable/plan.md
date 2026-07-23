## Goal
Schedule the existing `export-trayi-tables` edge function to run every Mon/Wed/Fri at 6:00 PM Asia/Kolkata, with duplicate-send prevention and logging.

## Approach
The edge function already handles fetch → CSV → ZIP → Resend email. We only need to add the scheduler + a de-dupe guard.

### 1. Duplicate-send guard (new table)
Create `public.trayi_export_runs`:
- `run_key text primary key` (e.g. `2026-07-27` — one row per scheduled IST date)
- `started_at`, `finished_at timestamptz`
- `status text` ('running' | 'success' | 'failed')
- `rows_exported jsonb` (per-table counts)
- `failed_tables jsonb`
- `email_status text`, `email_error text`

Grants: `service_role` only. RLS enabled, no policies (edge function uses service role).

### 2. Update `export-trayi-tables`
- Accept optional `{ run_key?: string, source: 'cron'|'manual' }` body.
- Compute `run_key` as today's date in Asia/Kolkata if not provided.
- Insert row with `ON CONFLICT (run_key) DO NOTHING`; if no row inserted → return `{ skipped: true, reason: 'already_ran' }` (prevents duplicate sends).
- After processing, update the row with per-table row counts, failed tables, and email delivery status.
- Keep existing per-table try/catch so one failure doesn't stop others (already implemented) — just make sure counts + errors are logged into the run row and console.

### 3. Scheduler (pg_cron + pg_net)
Enable `pg_cron` and `pg_net`, then:

```sql
select cron.schedule(
  'trayi-export-mwf-1800-ist',
  '30 12 * * 1,3,5',  -- 12:30 UTC = 18:00 Asia/Kolkata, Mon/Wed/Fri
  $$
  select net.http_post(
    url := 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/export-trayi-tables',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon>","apikey":"<anon>"}'::jsonb,
    body := jsonb_build_object('source','cron')
  );
  $$
);
```

Run via `supabase--insert` (not migration) since it carries the anon key.

Asia/Kolkata is UTC+5:30 with no DST, so a fixed UTC cron is correct year-round.

## Deliverables reported back to user
- **Scheduler name:** `trayi-export-mwf-1800-ist`
- **Schedule:** `30 12 * * 1,3,5` UTC = 18:00 Asia/Kolkata, Mon/Wed/Fri
- **Execution logs:** Cloud → Functions → `export-trayi-tables` logs; run history in `public.trayi_export_runs`; cron dispatch in `cron.job_run_details`
- **Manual test:** Cloud → Functions → `export-trayi-tables` → Invoke with `{"source":"manual","run_key":"manual-<timestamp>"}` (unique key bypasses the daily guard)
- **Disable/modify:** `select cron.unschedule('trayi-export-mwf-1800-ist');` or re-run `cron.schedule` with same name and a new expression

## Out of scope
No changes to order flow, existing mirror, CSV/ZIP/email logic, or recipient address (stays `Abhishek.S@kvpcorp.com`).