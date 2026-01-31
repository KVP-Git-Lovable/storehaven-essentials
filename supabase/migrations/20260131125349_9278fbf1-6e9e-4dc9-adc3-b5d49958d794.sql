-- POS Enhancement: Add new tables for split payments, held orders, returns, and cashier sessions

-- 1. Order Payments table for split/multiple payment methods
CREATE TABLE public.order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL, -- 'cash', 'upi', 'card', 'credit', 'loyalty_points'
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT, -- UPI ref, card last 4, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Held Orders table for hold/recall functionality
CREATE TABLE public.held_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_data JSONB NOT NULL, -- stores entire cart state
  customer_id UUID REFERENCES public.customers(id),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  store_id UUID REFERENCES public.stores(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Returns table for refund processing
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  store_id UUID REFERENCES public.stores(id),
  customer_id UUID REFERENCES public.customers(id),
  return_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason_code TEXT NOT NULL, -- 'defective', 'wrong_item', 'not_needed', 'size_issue', 'other'
  reason_notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL,
  refund_method TEXT NOT NULL, -- 'original', 'cash', 'store_credit'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Return Items table for partial returns
CREATE TABLE public.return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL,
  condition TEXT DEFAULT 'good', -- 'good', 'damaged', 'opened'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Cashier Sessions table for drawer/shift management
CREATE TABLE public.cashier_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  store_id UUID REFERENCES public.stores(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_out NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_closing NUMERIC(12,2),
  actual_closing NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Add new columns to products table for enhanced product info
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- 7. Add store_credit column to customers for store credit balance
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS store_credit NUMERIC(12,2) DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_payments (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view order payments" 
  ON public.order_payments FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create order payments" 
  ON public.order_payments FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for held_orders
CREATE POLICY "Authenticated users can view held orders" 
  ON public.held_orders FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create held orders" 
  ON public.held_orders FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update held orders" 
  ON public.held_orders FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete held orders" 
  ON public.held_orders FOR DELETE 
  USING (auth.role() = 'authenticated');

-- RLS Policies for returns
CREATE POLICY "Authenticated users can view returns" 
  ON public.returns FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create returns" 
  ON public.returns FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update returns" 
  ON public.returns FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- RLS Policies for return_items
CREATE POLICY "Authenticated users can view return items" 
  ON public.return_items FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create return items" 
  ON public.return_items FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for cashier_sessions
CREATE POLICY "Authenticated users can view cashier sessions" 
  ON public.cashier_sessions FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create cashier sessions" 
  ON public.cashier_sessions FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own cashier sessions" 
  ON public.cashier_sessions FOR UPDATE 
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_store_id ON public.held_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_expires_at ON public.held_orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON public.returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_store_id ON public.returns(store_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_user_id ON public.cashier_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_store_id ON public.cashier_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- Create trigger for returns updated_at
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for cashier_sessions updated_at
CREATE TRIGGER update_cashier_sessions_updated_at
  BEFORE UPDATE ON public.cashier_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();