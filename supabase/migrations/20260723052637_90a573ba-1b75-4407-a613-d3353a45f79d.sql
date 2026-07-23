-- Backup mirror: async triggers that ship row upserts to an external
-- Supabase project via the backup-mirror edge function. Fire-and-forget
-- (pg_net queues the HTTP request), so app writes are never blocked or
-- failed by mirror errors.

create extension if not exists pg_net with schema extensions;

-- Optional log for surfacing mirror failures without scanning net._http_response
create table if not exists public.backup_mirror_failures (
  id bigserial primary key,
  table_name text not null,
  row_id uuid,
  error text,
  created_at timestamptz not null default now()
);
grant select, insert on public.backup_mirror_failures to service_role;
alter table public.backup_mirror_failures enable row level security;

create or replace function public.mirror_to_backup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url  text := 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/backup-mirror';
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdGFzbmZzZG5mdHRheXhpYnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjgwMjYsImV4cCI6MjA5MzAwNDAyNn0.9Lxg9whQzv7eseBabKvBzLaalTWjnZs6hkl4JfLTb-E';
begin
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', api_key,
      'Authorization', 'Bearer ' || api_key
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'row', to_jsonb(NEW))
  );
  return NEW;
exception when others then
  -- Never break the parent transaction because of a mirror hiccup.
  insert into public.backup_mirror_failures(table_name, row_id, error)
  values (TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::uuid, SQLERRM);
  return NEW;
end;
$$;

-- Attach triggers to the six mirrored tables
drop trigger if exists trg_backup_mirror on public.customers;
create trigger trg_backup_mirror
  after insert or update on public.customers
  for each row execute function public.mirror_to_backup();

drop trigger if exists trg_backup_mirror on public.orders;
create trigger trg_backup_mirror
  after insert or update on public.orders
  for each row execute function public.mirror_to_backup();

drop trigger if exists trg_backup_mirror on public.order_items;
create trigger trg_backup_mirror
  after insert or update on public.order_items
  for each row execute function public.mirror_to_backup();

drop trigger if exists trg_backup_mirror on public.inventory_items;
create trigger trg_backup_mirror
  after insert or update on public.inventory_items
  for each row execute function public.mirror_to_backup();

drop trigger if exists trg_backup_mirror on public.profiles;
create trigger trg_backup_mirror
  after insert or update on public.profiles
  for each row execute function public.mirror_to_backup();

drop trigger if exists trg_backup_mirror on public.user_roles_master;
create trigger trg_backup_mirror
  after insert or update on public.user_roles_master
  for each row execute function public.mirror_to_backup();

-- Manual re-run function: batched backfill of every existing row.
-- Call with:  select public.backfill_backup_mirror();
create or replace function public.backfill_backup_mirror(batch_size integer default 200)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url  text := 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/backup-mirror';
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdGFzbmZzZG5mdHRheXhpYnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjgwMjYsImV4cCI6MjA5MzAwNDAyNn0.9Lxg9whQzv7eseBabKvBzLaalTWjnZs6hkl4JfLTb-E';
  tbl text;
  chunk jsonb;
  tables text[] := array['user_roles_master','profiles','customers','inventory_items','orders','order_items'];
begin
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
        perform net.http_post(
          url := fn_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', api_key,
            'Authorization', 'Bearer ' || api_key
          ),
          body := jsonb_build_object('table', tbl, 'rows', chunk)
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Fire the one-time backfill now.
select public.backfill_backup_mirror();