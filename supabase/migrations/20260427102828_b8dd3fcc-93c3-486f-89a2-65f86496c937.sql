ALTER TABLE public.list_views
ADD COLUMN IF NOT EXISTS column_order jsonb NOT NULL DEFAULT '[]'::jsonb;