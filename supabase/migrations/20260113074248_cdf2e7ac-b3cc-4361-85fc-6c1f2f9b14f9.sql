-- Create customers table for phone-based identification
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(15) NOT NULL UNIQUE,
  name VARCHAR(255),
  email VARCHAR(255),
  loyalty_points INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  store_id UUID REFERENCES public.stores(id),
  customer_id UUID REFERENCES public.customers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL, -- 'cash', 'upi'
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  payment_reference VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  notes TEXT,
  created_by VARCHAR(255) NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schemes/promotions table
CREATE TABLE public.schemes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed', 'buy_x_get_y'
  discount_value NUMERIC NOT NULL,
  min_purchase_amount NUMERIC DEFAULT 0,
  min_quantity INTEGER DEFAULT 1,
  buy_quantity INTEGER,
  get_quantity INTEGER,
  applicable_items UUID[], -- Array of item IDs, null means all items
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;

-- Create policies for customers
CREATE POLICY "Allow public read access" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.customers FOR DELETE USING (true);

-- Create policies for orders
CREATE POLICY "Allow public read access" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.orders FOR DELETE USING (true);

-- Create policies for order_items
CREATE POLICY "Allow public read access" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.order_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.order_items FOR DELETE USING (true);

-- Create policies for schemes
CREATE POLICY "Allow public read access" ON public.schemes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.schemes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.schemes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.schemes FOR DELETE USING (true);

-- Create function to update customer stats
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.customers
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total_amount,
      updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for customer stats
CREATE TRIGGER update_customer_stats_trigger
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_stats();