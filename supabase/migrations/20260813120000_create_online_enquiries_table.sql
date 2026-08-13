-- Create online_enquiries table for tracking website enquiries
create table if not exists public.online_enquiries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  date date not null,
  interest text,
  status text default 'new' not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add constraints
alter table public.online_enquiries add constraint online_enquiries_phone_length 
  check (phone is null or length(phone) <= 15);

alter table public.online_enquiries add constraint online_enquiries_email_format 
  check (email is null or email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Create indexes for common queries
create index if not exists idx_online_enquiries_email on public.online_enquiries(email);
create index if not exists idx_online_enquiries_phone on public.online_enquiries(phone);
create index if not exists idx_online_enquiries_date on public.online_enquiries(date);
create index if not exists idx_online_enquiries_status on public.online_enquiries(status);
create index if not exists idx_online_enquiries_created_at on public.online_enquiries(created_at);

-- Enable RLS
alter table public.online_enquiries enable row level security;

-- Create RLS policies (authenticated users can view all, authenticated users can insert)
create policy "Enable read access for authenticated users" on public.online_enquiries
  for select
  to authenticated
  using (true);

create policy "Enable insert for authenticated users" on public.online_enquiries
  for insert
  to authenticated
  with check (true);

create policy "Enable update for authenticated users" on public.online_enquiries
  for update
  to authenticated
  using (true);

create policy "Enable delete for authenticated users" on public.online_enquiries
  for delete
  to authenticated
  using (true);
