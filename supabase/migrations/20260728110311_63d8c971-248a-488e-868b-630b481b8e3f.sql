CREATE TABLE public.old_gold_exchanges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  order_id UUID REFERENCES public.orders(id),
  exchange_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_by UUID,
  total_old_gold_value NUMERIC NOT NULL DEFAULT 0,
  total_purchase_value NUMERIC NOT NULL DEFAULT 0,
  additional_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.old_gold_exchanges TO authenticated;
GRANT ALL ON public.old_gold_exchanges TO service_role;
ALTER TABLE public.old_gold_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view old gold exchanges" ON public.old_gold_exchanges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create old gold exchanges" ON public.old_gold_exchanges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update old gold exchanges" ON public.old_gold_exchanges FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.old_gold_exchange_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange_id UUID NOT NULL REFERENCES public.old_gold_exchanges(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ornament_type TEXT,
  gross_wt NUMERIC NOT NULL DEFAULT 0,
  karat TEXT,
  measured_purity NUMERIC NOT NULL DEFAULT 0,
  fine_gold_wt NUMERIC NOT NULL DEFAULT 0,
  purchase_rate NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  calculated_value NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.old_gold_exchange_items TO authenticated;
GRANT ALL ON public.old_gold_exchange_items TO service_role;
ALTER TABLE public.old_gold_exchange_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view old gold exchange items" ON public.old_gold_exchange_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create old gold exchange items" ON public.old_gold_exchange_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_old_gold_exchange_items_exchange ON public.old_gold_exchange_items(exchange_id);
CREATE INDEX idx_old_gold_exchanges_customer ON public.old_gold_exchanges(customer_id);

CREATE TRIGGER update_old_gold_exchanges_updated_at
BEFORE UPDATE ON public.old_gold_exchanges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.process_old_gold_exchange(
  p_customer_id uuid,
  p_old_gold_items jsonb,
  p_purchase_items jsonb,
  p_purchase_subtotal numeric,
  p_purchase_discount numeric,
  p_purchase_tax numeric,
  p_purchase_total numeric,
  p_payment_method text DEFAULT 'cash',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_gold_value numeric := 0;
  v_additional numeric := 0;
  v_order_id uuid;
  v_exchange_id uuid;
  v_order_number text;
  v_exchange_number text;
  r jsonb;
  v_fine numeric;
  v_value numeric;
BEGIN
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer is required'; END IF;
  IF p_old_gold_items IS NULL OR jsonb_array_length(p_old_gold_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one old gold item';
  END IF;
  IF p_purchase_items IS NULL OR jsonb_array_length(p_purchase_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one new purchase item';
  END IF;

  SELECT COALESCE(SUM(
    (COALESCE((x->>'gross_wt')::numeric,0) * COALESCE((x->>'measured_purity')::numeric,0) / 100.0)
      * COALESCE((x->>'purchase_rate')::numeric,0)
    - COALESCE((x->>'deductions')::numeric,0)
  ), 0)
  INTO v_old_gold_value
  FROM jsonb_array_elements(p_old_gold_items) x;

  IF COALESCE(p_purchase_total, 0) < v_old_gold_value THEN
    RAISE EXCEPTION 'The purchase value must be greater than or equal to the value of the old gold. Cash refunds, wallet balance and store credit are not supported.';
  END IF;

  v_additional := COALESCE(p_purchase_total, 0) - v_old_gold_value;

  v_order_number := 'OGX-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS');
  v_exchange_number := 'OG-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS');

  INSERT INTO public.orders (
    order_number, customer_id, order_type, status, payment_status, payment_method,
    subtotal, discount_amount, tax_amount, total_amount, notes, created_by
  ) VALUES (
    v_order_number, p_customer_id, 'old_gold_exchange', 'completed', 'paid',
    COALESCE(p_payment_method, 'cash'),
    COALESCE(p_purchase_subtotal, 0), COALESCE(p_purchase_discount, 0),
    COALESCE(p_purchase_tax, 0), COALESCE(p_purchase_total, 0),
    p_notes, COALESCE(v_uid::text, 'old-gold-exchange')
  ) RETURNING id INTO v_order_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_purchase_items) LOOP
    INSERT INTO public.order_items (
      order_id, item_id, quantity, unit_price, total_amount, tax_amount,
      dia_price, cs_price, making_charges
    ) VALUES (
      v_order_id,
      (r->>'item_id')::uuid,
      COALESCE((r->>'quantity')::int, 1),
      COALESCE((r->>'unit_price')::numeric, 0),
      COALESCE((r->>'total_amount')::numeric, 0),
      0,
      COALESCE((r->>'dia_price')::numeric, 0),
      COALESCE((r->>'cs_price')::numeric, 0),
      COALESCE((r->>'making_charges')::numeric, 0)
    );

    INSERT INTO public.stock_ledger (
      item_id, location_type, location_id, transaction_type, quantity_change,
      unit_cost, reference_type, reference_id, created_by, notes
    ) VALUES (
      (r->>'item_id')::uuid, 'global', NULL, 'sale',
      -ABS(COALESCE((r->>'quantity')::int, 1)),
      COALESCE((r->>'unit_price')::numeric, 0), 'order', v_order_id,
      COALESCE(v_uid::text, 'old-gold-exchange'), 'Old gold exchange purchase ' || v_order_number
    );
  END LOOP;

  INSERT INTO public.old_gold_exchanges (
    exchange_number, customer_id, order_id, processed_by,
    total_old_gold_value, total_purchase_value, additional_amount,
    payment_method, status, notes
  ) VALUES (
    v_exchange_number, p_customer_id, v_order_id, v_uid,
    v_old_gold_value, COALESCE(p_purchase_total, 0), v_additional,
    COALESCE(p_payment_method, 'cash'), 'completed', p_notes
  ) RETURNING id INTO v_exchange_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_old_gold_items) LOOP
    v_fine := COALESCE((r->>'gross_wt')::numeric,0) * COALESCE((r->>'measured_purity')::numeric,0) / 100.0;
    v_value := v_fine * COALESCE((r->>'purchase_rate')::numeric,0) - COALESCE((r->>'deductions')::numeric,0);
    INSERT INTO public.old_gold_exchange_items (
      exchange_id, description, ornament_type, gross_wt, karat, measured_purity,
      fine_gold_wt, purchase_rate, deductions, calculated_value, remarks
    ) VALUES (
      v_exchange_id,
      COALESCE(NULLIF(r->>'description',''), 'Old gold'),
      NULLIF(r->>'ornament_type',''),
      COALESCE((r->>'gross_wt')::numeric,0),
      NULLIF(r->>'karat',''),
      COALESCE((r->>'measured_purity')::numeric,0),
      v_fine,
      COALESCE((r->>'purchase_rate')::numeric,0),
      COALESCE((r->>'deductions')::numeric,0),
      v_value,
      NULLIF(r->>'remarks','')
    );
  END LOOP;

  RETURN jsonb_build_object(
    'exchange_id', v_exchange_id,
    'exchange_number', v_exchange_number,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_old_gold_value', v_old_gold_value,
    'total_purchase_value', COALESCE(p_purchase_total, 0),
    'additional_amount', v_additional
  );
END;
$$;