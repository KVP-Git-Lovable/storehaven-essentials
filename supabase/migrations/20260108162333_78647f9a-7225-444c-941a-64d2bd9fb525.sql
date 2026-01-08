-- Create meter_masters table
CREATE TABLE public.meter_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  reading_parameter_count INTEGER NOT NULL DEFAULT 1,
  reading_parameters TEXT[] NOT NULL DEFAULT '{}',
  details_to_capture TEXT NOT NULL DEFAULT 'Both',
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_modified_by TEXT NOT NULL DEFAULT 'System',
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meter_masters ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access" ON public.meter_masters FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.meter_masters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.meter_masters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.meter_masters FOR DELETE USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meter_masters_updated_at
BEFORE UPDATE ON public.meter_masters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();