CREATE TABLE IF NOT EXISTS public.app_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_cache ENABLE ROW LEVEL SECURITY;