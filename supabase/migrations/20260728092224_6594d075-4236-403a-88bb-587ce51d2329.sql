-- 1. Extend returns
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS return_type text NOT NULL DEFAULT 'exchange',
  ADD COLUMN IF NOT EXISTS exchange_order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS return_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_purchase_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by_user uuid;

ALTER TABLE public.returns ALTER COLUMN reason_code SET DEFAULT 'exchange';
ALTER TABLE public.returns ALTER COLUMN refund_amount SET DEFAULT 0;
ALTER TABLE public.returns ALTER COLUMN refund_method SET DEFAULT 'exchange';

-- 2. Extend return_items with frozen invoice snapshot
ALTER TABLE public.return_items
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id),
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS gross_wt numeric,
  ADD COLUMN IF NOT EXISTS net_wt numeric,
  ADD COLUMN IF NOT EXISTS stone_wt numeric,
  ADD COLUMN IF NOT EXISTS purity text,
  ADD COLUMN IF NOT EXISTS metal_rate numeric,
  ADD COLUMN IF NOT EXISTS making_charges numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cs_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_selling_price numeric NOT NULL DEFAULT 0;

ALTER TABLE public.return_items ALTER COLUMN refund_amount SET DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;

-- 3. Inventory status + history
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS inventory_status text NOT NULL DEFAULT 'available';

CREATE TABLE IF NOT EXISTS public.inventory_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reference_type text,
  reference_id uuid,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.inventory_status_history TO authenticated;
GRANT ALL ON public.inventory_status_history TO service_role;

ALTER TABLE public.inventory_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view inventory status history" ON public.inventory_status_history;
CREATE POLICY "Authenticated can view inventory status history"
  ON public.inventory_status_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert inventory status history" ON public.inventory_status_history;
CREATE POLICY "Authenticated can insert inventory status history"
  ON public.inventory_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventory_status_history_item ON public.inventory_status_history(item_id);

-- log status changes
CREATE OR REPLACE FUNCTION public.log_inventory_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.inventory_status_history(item_id, from_status, to_status, reference_type)
    VALUES (NEW.id, NULL, COALESCE(NEW.inventory_status, 'available'), 'created');
    RETURN NEW;
  END IF;
  IF NEW.inventory_status IS DISTINCT FROM OLD.inventory_status THEN
    INSERT INTO public.inventory_status_history(item_id, from_status, to_status, reference_type)
    VALUES (NEW.id, OLD.inventory_status, NEW.inventory_status, 'status_change');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_status_change ON public.inventory_items;
CREATE TRIGGER trg_inventory_status_change
AFTER INSERT OR UPDATE OF inventory_status ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.log_inventory_status_change();

-- stock movements drive status
CREATE OR REPLACE FUNCTION public.sync_inventory_status_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status text;
BEGIN
  IF NEW.item_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.transaction_type = 'sale' THEN
    new_status := 'sold';
  ELSIF NEW.quantity_change > 0 THEN
    new_status := 'available';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.inventory_items
     SET inventory_status = new_status
   WHERE id = NEW.item_id
     AND inventory_status IS DISTINCT FROM new_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_ledger_status ON public.stock_ledger;
CREATE TRIGGER trg_stock_ledger_status
AFTER INSERT ON public.stock_ledger
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_status_from_ledger();

-- 4. Atomic sales return processor
CREATE OR REPLACE FUNCTION public.process_sales_return(
  p_customer_id uuid,
  p_order_id uuid,
  p_return_items jsonb,
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
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_return_value numeric := 0;
  v_additional numeric := 0;
  v_order_id uuid;
  v_return_id uuid;
  v_order_number text;
  v_return_number text;
  r jsonb;
BEGIN
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer is required'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Original invoice is required'; END IF;
  IF p_return_items IS NULL OR jsonb_array_length(p_return_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to return';
  END IF;
  IF p_purchase_items IS NULL OR jsonb_array_length(p_purchase_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one new purchase item';
  END IF;

  SELECT COALESCE(SUM((x->>'line_total')::numeric), 0)
    INTO v_return_value
    FROM jsonb_array_elements(p_return_items) x;

  IF COALESCE(p_purchase_total, 0) < v_return_value THEN
    RAISE EXCEPTION 'The purchase value must be greater than or equal to the return value. Cash refunds and store credit are not supported.';
  END IF;

  v_additional := COALESCE(p_purchase_total, 0) - v_return_value;

  v_order_number := 'EXC-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS');
  v_return_number := 'SR-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS');

  INSERT INTO public.orders (
    order_number, customer_id, order_type, status, payment_status, payment_method,
    subtotal, discount_amount, tax_amount, total_amount, notes, created_by
  ) VALUES (
    v_order_number, p_customer_id, 'exchange', 'completed',
    CASE WHEN v_additional > 0 THEN 'paid' ELSE 'paid' END,
    COALESCE(p_payment_method, 'cash'),
    COALESCE(p_purchase_subtotal, 0), COALESCE(p_purchase_discount, 0),
    COALESCE(p_purchase_tax, 0), COALESCE(p_purchase_total, 0),
    p_notes, COALESCE(v_uid::text, 'sales-return')
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
      COALESCE(v_uid::text, 'sales-return'), 'Exchange purchase ' || v_order_number
    );
  END LOOP;

  INSERT INTO public.returns (
    return_number, order_id, customer_id, reason_code, reason_notes,
    subtotal, refund_amount, refund_method, status, return_type,
    exchange_order_id, return_value, new_purchase_value, additional_amount,
    processed_by, created_by_user
  ) VALUES (
    v_return_number, p_order_id, p_customer_id, 'exchange', p_notes,
    v_return_value, 0, 'exchange', 'completed', 'exchange',
    v_order_id, v_return_value, COALESCE(p_purchase_total, 0), v_additional,
    v_uid, v_uid
  ) RETURNING id INTO v_return_id;

  FOR r IN SELECT * FROM jsonb_array_elements(p_return_items) LOOP
    INSERT INTO public.return_items (
      return_id, order_item_id, item_id, sku, product_name, category,
      gross_wt, net_wt, stone_wt, purity, metal_rate, making_charges,
      dia_price, cs_price, tax_amount, original_selling_price,
      quantity, unit_price, refund_amount
    ) VALUES (
      v_return_id,
      (r->>'order_item_id')::uuid,
      (r->>'item_id')::uuid,
      r->>'sku',
      COALESCE(r->>'product_name', 'Item'),
      r->>'category',
      NULLIF(r->>'gross_wt','')::numeric,
      NULLIF(r->>'net_wt','')::numeric,
      NULLIF(r->>'stone_wt','')::numeric,
      r->>'purity',
      NULLIF(r->>'metal_rate','')::numeric,
      COALESCE((r->>'making_charges')::numeric, 0),
      COALESCE((r->>'dia_price')::numeric, 0),
      COALESCE((r->>'cs_price')::numeric, 0),
      COALESCE((r->>'tax_amount')::numeric, 0),
      COALESCE((r->>'original_selling_price')::numeric, 0),
      COALESCE((r->>'quantity')::int, 1),
      COALESCE((r->>'unit_price')::numeric, 0),
      0
    );

    INSERT INTO public.stock_ledger (
      item_id, location_type, location_id, transaction_type, quantity_change,
      unit_cost, reference_type, reference_id, created_by, notes
    ) VALUES (
      (r->>'item_id')::uuid, 'global', NULL, 'sales_return',
      ABS(COALESCE((r->>'quantity')::int, 1)),
      COALESCE((r->>'unit_price')::numeric, 0), 'sales_return', v_return_id,
      COALESCE(v_uid::text, 'sales-return'), 'Sales return ' || v_return_number
    );

    UPDATE public.inventory_items
       SET inventory_status = 'available', updated_at = now()
     WHERE id = (r->>'item_id')::uuid;
  END LOOP;

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_return_number,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'return_value', v_return_value,
    'new_purchase_value', COALESCE(p_purchase_total, 0),
    'additional_amount', v_additional
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sales_return(uuid, uuid, jsonb, jsonb, numeric, numeric, numeric, numeric, text, text) TO authenticated;