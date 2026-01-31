-- Create footfall_records table
CREATE TABLE public.footfall_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  exit_count INTEGER NOT NULL DEFAULT 0,
  peak_hour_start TIME,
  peak_hour_end TIME,
  peak_hour_count INTEGER,
  conversion_count INTEGER DEFAULT 0, -- customers who made purchase
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_store_date UNIQUE (store_id, record_date)
);

-- Enable RLS
ALTER TABLE public.footfall_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all authenticated users to view footfall" 
ON public.footfall_records FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert footfall" 
ON public.footfall_records FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update footfall" 
ON public.footfall_records FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete footfall" 
ON public.footfall_records FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create index for date-based queries
CREATE INDEX idx_footfall_records_date ON public.footfall_records(record_date DESC);
CREATE INDEX idx_footfall_records_store_date ON public.footfall_records(store_id, record_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_footfall_records_updated_at
BEFORE UPDATE ON public.footfall_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();