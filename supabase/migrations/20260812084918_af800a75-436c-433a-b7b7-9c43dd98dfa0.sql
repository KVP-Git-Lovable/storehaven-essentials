CREATE TABLE public.online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  fulfillment_method text NOT NULL DEFAULT 'delivery',
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_pincode text,
  preferred_pickup_date date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_orders TO authenticated;
GRANT ALL ON public.online_orders TO service_role;

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view online orders"
  ON public.online_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert online orders"
  ON public.online_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update online orders"
  ON public.online_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete online orders"
  ON public.online_orders FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_online_orders_created_at ON public.online_orders (created_at DESC);

CREATE TRIGGER update_online_orders_updated_at
  BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();