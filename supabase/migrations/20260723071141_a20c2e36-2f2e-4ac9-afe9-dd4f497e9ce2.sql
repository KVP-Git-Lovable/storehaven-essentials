
CREATE TABLE public.trayi_export_runs (
  run_key text PRIMARY KEY,
  source text NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_exported jsonb NOT NULL DEFAULT '{}'::jsonb,
  failed_tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_status text,
  email_error text
);
GRANT ALL ON public.trayi_export_runs TO service_role;
ALTER TABLE public.trayi_export_runs ENABLE ROW LEVEL SECURITY;
