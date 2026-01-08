-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create positions table
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'product',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments
CREATE POLICY "Allow public read access" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.departments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.departments FOR DELETE USING (true);

-- RLS policies for positions
CREATE POLICY "Allow public read access" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.positions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.positions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.positions FOR DELETE USING (true);

-- RLS policies for categories
CREATE POLICY "Allow public read access" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.categories FOR DELETE USING (true);

-- RLS policies for locations
CREATE POLICY "Allow public read access" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.locations FOR DELETE USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();