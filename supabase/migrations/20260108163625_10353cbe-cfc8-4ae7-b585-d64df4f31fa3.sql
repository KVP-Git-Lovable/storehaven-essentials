-- Drop old utilities table and recreate with new structure
DROP TABLE IF EXISTS utilities;

-- Create new utility_readings table linked to meter_masters
CREATE TABLE public.utility_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store TEXT NOT NULL,
  meter_master_id UUID NOT NULL REFERENCES public.meter_masters(id) ON DELETE CASCADE,
  reading_date TEXT NOT NULL,
  readings JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_modified_by TEXT NOT NULL DEFAULT 'System',
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access" ON public.utility_readings FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.utility_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.utility_readings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.utility_readings FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_utility_readings_updated_at
  BEFORE UPDATE ON public.utility_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
