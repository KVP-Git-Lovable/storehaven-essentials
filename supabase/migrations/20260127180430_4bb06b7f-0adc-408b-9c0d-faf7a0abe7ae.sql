-- Add asset_status column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS asset_status text NOT NULL DEFAULT 'requisition-raised';

-- Create asset_status_history table for audit trail
CREATE TABLE public.asset_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT 'System',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access" ON public.asset_status_history
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.asset_status_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.asset_status_history
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.asset_status_history
  FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX idx_asset_status_history_asset_id ON public.asset_status_history(asset_id);
CREATE INDEX idx_asset_status_history_changed_at ON public.asset_status_history(changed_at);