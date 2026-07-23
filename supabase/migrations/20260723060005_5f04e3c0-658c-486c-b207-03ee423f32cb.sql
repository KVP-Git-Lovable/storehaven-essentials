CREATE TABLE IF NOT EXISTS public.backup_mirror_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text,
  source_table text NOT NULL,
  destination_table text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  http_status integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.backup_mirror_audit TO authenticated;
GRANT ALL ON public.backup_mirror_audit TO service_role;

ALTER TABLE public.backup_mirror_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view backup mirror audit" ON public.backup_mirror_audit;
CREATE POLICY "Admins can view backup mirror audit"
ON public.backup_mirror_audit
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_backup_mirror_audit_created_at ON public.backup_mirror_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_mirror_audit_source_table ON public.backup_mirror_audit (source_table, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_mirror_audit_trace_id ON public.backup_mirror_audit (trace_id);

CREATE OR REPLACE FUNCTION public.mirror_to_backup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  fn_url  text := current_setting('app.settings.backup_mirror_url', true);
  api_key text := current_setting('app.settings.backup_mirror_api_key', true);
  trace text := TG_TABLE_NAME || '-' || (to_jsonb(NEW)->>'id') || '-' || extract(epoch from clock_timestamp())::text;
begin
  if fn_url is null or fn_url = '' then
    fn_url := 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/backup-mirror';
  end if;

  if api_key is null or api_key = '' then
    api_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdGFzbmZzZG5mdHRheXhpYnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjgwMjYsImV4cCI6MjA5MzAwNDAyNn0.9Lxg9whQzv7eseBabKvBzLaalTWjnZs6hkl4JfLTb-E';
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', api_key,
      'Authorization', 'Bearer ' || api_key,
      'x-backup-trace-id', trace
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'row', to_jsonb(NEW), 'trace_id', trace)
  );
  return NEW;
exception when others then
  insert into public.backup_mirror_failures(table_name, row_id, error)
  values (TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::uuid, SQLERRM);
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_backup_mirror(batch_size integer DEFAULT 200)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  fn_url  text := current_setting('app.settings.backup_mirror_url', true);
  api_key text := current_setting('app.settings.backup_mirror_api_key', true);
  tbl text;
  chunk jsonb;
  trace text;
  tables text[] := array['user_roles_master','profiles','customers','inventory_items','orders','order_items'];
begin
  if fn_url is null or fn_url = '' then
    fn_url := 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/backup-mirror';
  end if;

  if api_key is null or api_key = '' then
    api_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdGFzbmZzZG5mdHRheXhpYnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjgwMjYsImV4cCI6MjA5MzAwNDAyNn0.9Lxg9whQzv7eseBabKvBzLaalTWjnZs6hkl4JfLTb-E';
  end if;

  foreach tbl in array tables loop
    for chunk in
      execute format($f$
        with numbered as (
          select to_jsonb(t) as row, row_number() over (order by t.id) as rn
          from public.%I t
        )
        select coalesce(jsonb_agg(row), '[]'::jsonb)
        from numbered
        group by ((rn - 1) / %s)
        order by min(rn)
      $f$, tbl, batch_size)
    loop
      if jsonb_array_length(chunk) > 0 then
        trace := 'backfill-' || tbl || '-' || extract(epoch from clock_timestamp())::text;
        perform net.http_post(
          url := fn_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', api_key,
            'Authorization', 'Bearer ' || api_key,
            'x-backup-trace-id', trace
          ),
          body := jsonb_build_object('table', tbl, 'rows', chunk, 'trace_id', trace)
        );
      end if;
    end loop;
  end loop;
end;
$function$;