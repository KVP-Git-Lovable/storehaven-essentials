CREATE TABLE public.order_import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  warning_count integer not null default 0,
  imported_by uuid references auth.users(id),
  error_summary jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

ALTER TABLE public.order_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_order_import_logs"
ON public.order_import_logs
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "users_read_own_order_import_logs"
ON public.order_import_logs
FOR SELECT
TO authenticated
USING (imported_by = auth.uid());

CREATE POLICY "users_insert_own_order_import_logs"
ON public.order_import_logs
FOR INSERT
TO authenticated
WITH CHECK (imported_by = auth.uid());