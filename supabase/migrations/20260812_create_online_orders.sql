-- Create online_orders table for storing website orders from trayi-sparkle-elegance
CREATE TABLE public.online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  fulfillment_method VARCHAR(20) NOT NULL, -- 'delivery' or 'pickup'

  -- Delivery address (if delivery)
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_pincode VARCHAR(10),

  -- Pickup details (if pickup)
  preferred_pickup_date DATE,

  -- Order items (stored as JSONB)
  items JSONB NOT NULL, -- Array of {productId, name, price, qty, purity, metal, size}

  subtotal NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,

  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_online_orders_email ON public.online_orders(customer_email);
CREATE INDEX idx_online_orders_phone ON public.online_orders(customer_phone);
CREATE INDEX idx_online_orders_created ON public.online_orders(created_at DESC);
CREATE INDEX idx_online_orders_status ON public.online_orders(status);

-- Enable RLS
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow public access (can be restricted later if needed)
CREATE POLICY "Allow public read access" ON public.online_orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.online_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.online_orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.online_orders FOR DELETE USING (true);
