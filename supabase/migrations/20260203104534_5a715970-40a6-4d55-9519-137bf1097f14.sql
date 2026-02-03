-- Create holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'national',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing holidays (everyone can view)
CREATE POLICY "Anyone can view holidays"
  ON public.holidays
  FOR SELECT
  USING (true);

-- Create policy for managing holidays (authenticated users only)
CREATE POLICY "Authenticated users can manage holidays"
  ON public.holidays
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_holidays_updated_at
  BEFORE UPDATE ON public.holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default holidays for 2026
INSERT INTO public.holidays (name, date, type, is_optional) VALUES
  ('Republic Day', '2026-01-26', 'national', false),
  ('Holi', '2026-03-25', 'festival', false),
  ('Good Friday', '2026-03-29', 'religious', true),
  ('Independence Day', '2026-08-15', 'national', false),
  ('Gandhi Jayanti', '2026-10-02', 'national', false),
  ('Diwali', '2026-11-01', 'festival', false),
  ('Christmas', '2026-12-25', 'religious', false);