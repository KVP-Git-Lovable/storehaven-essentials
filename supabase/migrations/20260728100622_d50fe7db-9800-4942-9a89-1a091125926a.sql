CREATE TABLE IF NOT EXISTS public.sales_return_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  item_id uuid,
  order_id uuid,
  user_id uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sales_return_validation_log TO authenticated;
GRANT ALL ON public.sales_return_validation_log TO service_role;

ALTER TABLE public.sales_return_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view validation log"
ON public.sales_return_validation_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert validation log"
ON public.sales_return_validation_log FOR INSERT TO authenticated WITH CHECK (true);

-- Validation helper: checks live inventory state for a set of items.
-- Locks each inventory row (FOR UPDATE) so concurrent returns of the same LL Code serialize.
CREATE OR REPLACE FUNCTION public.validate_sales_return_items(_item_ids uuid[], _log boolean DEFAULT true, _order_id uuid DEFAULT NULL)
RETURNS TABLE(item_id uuid, sku text, is_valid boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  rec record;
  v_item record;
  v_reason text;
  v_sku text;
BEGIN
  FOREACH rec IN ARRAY ARRAY[]::record[] LOOP END LOOP; -- no-op

  FOR v_item IN
    SELECT unnest(_item_ids) AS iid
  LOOP
    v_reason := NULL;
    v_sku := NULL;

    SELECT i.id, i.sku, i.inventory_status INTO rec
    FROM public.inventory_items i
    WHERE i.id = v_item.iid
    FOR UPDATE;

    IF NOT FOUND THEN
      v_reason := 'This LL Code does not exist in inventory.';
    ELSE
      v_sku := rec.sku;
      IF rec.inventory_status = 'returned' OR rec.inventory_status = 'available' THEN
        IF EXISTS (
          SELECT 1 FROM public.return_items ri WHERE ri.item_id = v_item.iid
        ) THEN
          v_reason := 'This LL Code has already been returned and cannot be returned again until it has been sold again.';
        ELSE
          v_reason := 'This item cannot be returned because it is not currently marked as Sold.';
        END IF;
      ELSIF COALESCE(rec.inventory_status, '') <> 'sold' THEN
        v_reason := 'This item cannot be returned because it is not currently marked as Sold.';
      END IF;
    END IF;

    IF v_reason IS NOT NULL AND _log THEN
      INSERT INTO public.sales_return_validation_log (sku, item_id, order_id, user_id, reason)
      VALUES (v_sku, v_item.iid, _order_id, v_uid, v_reason);
    END IF;

    item_id := v_item.iid;
    sku := v_sku;
    is_valid := (v_reason IS NULL);
    reason := v_reason;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_sales_return_items(uuid[], boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_sales_return(p_customer_id uuid, p_order_id uuid, p_return_items jsonb, p_purchase_items jsonb, p_purchase_subtotal numeric, p_purchase_discount numeric, p_purchase_tax numeric, p_purchase_total numeric, p_payment_method text DEFAULT 'cash'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_return_value numeric := 0;
  v_additional numeric := 0;
  v_order_id uuid;
  v_return_id uuid;
  v_order_number text;
  v_return_number text;
  r jsonb;
  v_item_ids uuid[];
  v_bad record;
BEGIN
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer is required'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Original invoice is required'; END IF;
  IF p_return_items IS NULL OR jsonb_array_length(p_return_items) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to return';
  END IF;
  IF p_purchase_items IS NULL OR jsonb_array_length(p_purchase_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one new purchase item';
  END IF;

  -- Validate against CURRENT inventory state, with row locks, before any writes
  SELECT array_agg((x->>'item_id')::uuid)
    INTO v_item_ids
    FROM jsonb_array_elements(p_return_items) x
   WHERE x->>'item_id' IS NOT NULL;

  IF v_item_ids IS NULL OR array_length(v_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Returned items must reference a valid inventory LL Code.';
  END IF;

  SELECT * INTO v_bad
    FROM public.validate_sales_return_items(v_item_ids, true, p_order_id) v
   WHERE v.is_valid = false
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION '%', COALESCE(v_bad.sku || ': ', '') || v_bad.reason;
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
    'paid',
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
$function$;