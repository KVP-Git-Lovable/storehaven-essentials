-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  manager TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  assets INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rentals/leases table
CREATE TABLE public.rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store TEXT NOT NULL,
  landlord TEXT NOT NULL,
  rent NUMERIC NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  warranty TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  condition TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create spares table
CREATE TABLE public.spares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  unit_price NUMERIC NOT NULL,
  supplier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  vendor TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  join_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create utilities table
CREATE TABLE public.utilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store TEXT NOT NULL,
  utility_type TEXT NOT NULL,
  meter_reading NUMERIC NOT NULL,
  reading_date TEXT NOT NULL,
  previous_reading NUMERIC,
  consumption NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service_contracts table
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor TEXT NOT NULL,
  service_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance_tasks table
CREATE TABLE public.maintenance_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset TEXT NOT NULL,
  task_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  last_done TEXT NOT NULL,
  next_due TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  location TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public read/write for now - can be secured later with auth)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for development - secure with auth later)
CREATE POLICY "Allow public read access" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.stores FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.rentals FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.rentals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.rentals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.rentals FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.products FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.assets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.assets FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.spares FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.spares FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.spares FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.spares FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.vendors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.vendors FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.expenses FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.employees FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.utilities FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.utilities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.utilities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.utilities FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.service_contracts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.service_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.service_contracts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.service_contracts FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.maintenance_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.maintenance_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.maintenance_tasks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.maintenance_tasks FOR DELETE USING (true);

CREATE POLICY "Allow public read access" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.incidents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.incidents FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rentals_updated_at BEFORE UPDATE ON public.rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_spares_updated_at BEFORE UPDATE ON public.spares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_utilities_updated_at BEFORE UPDATE ON public.utilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_contracts_updated_at BEFORE UPDATE ON public.service_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_tasks_updated_at BEFORE UPDATE ON public.maintenance_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();