
-- Enum for tax component types
DO $$ BEGIN
  CREATE TYPE public.tax_component_type AS ENUM ('CGST','SGST','IGST','CESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tax masters
CREATE TABLE public.tax_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'GST',
  description TEXT,
  hsn_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  apply_to_primary_orders BOOLEAN NOT NULL DEFAULT true,
  apply_to_secondary_orders BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  version INTEGER NOT NULL DEFAULT 1,
  cloned_from_id UUID REFERENCES public.tax_masters(id) ON DELETE SET NULL,
  total_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_masters TO authenticated;
GRANT ALL ON public.tax_masters TO service_role;

ALTER TABLE public.tax_masters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tax masters" ON public.tax_masters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage tax masters" ON public.tax_masters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX tax_masters_single_default_idx
  ON public.tax_masters ((is_default)) WHERE is_default = true;

CREATE TRIGGER trg_tax_masters_updated_at
  BEFORE UPDATE ON public.tax_masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tax components
CREATE TABLE public.tax_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_master_id UUID NOT NULL REFERENCES public.tax_masters(id) ON DELETE CASCADE,
  component_type public.tax_component_type NOT NULL,
  percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tax_master_id, component_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_components TO authenticated;
GRANT ALL ON public.tax_components TO service_role;

ALTER TABLE public.tax_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tax components" ON public.tax_components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage tax components" ON public.tax_components
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX tax_components_master_idx ON public.tax_components(tax_master_id);

CREATE TRIGGER trg_tax_components_updated_at
  BEFORE UPDATE ON public.tax_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalculate total_rate on components change
CREATE OR REPLACE FUNCTION public.recalc_tax_master_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  master_id UUID := COALESCE(NEW.tax_master_id, OLD.tax_master_id);
BEGIN
  UPDATE public.tax_masters tm
     SET total_rate = COALESCE((
       SELECT SUM(percentage) FROM public.tax_components
        WHERE tax_master_id = master_id AND is_enabled = true
     ), 0),
     updated_at = now()
   WHERE tm.id = master_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_tax_components_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.tax_components
  FOR EACH ROW EXECUTE FUNCTION public.recalc_tax_master_total();

-- Inventory item link to tax slab
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS tax_master_id UUID REFERENCES public.tax_masters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_items_tax_master_idx
  ON public.inventory_items(tax_master_id);

-- Auto-assign default tax master on new inventory items
CREATE OR REPLACE FUNCTION public.set_default_tax_master()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tax_master_id IS NULL THEN
    SELECT id INTO NEW.tax_master_id
      FROM public.tax_masters
     WHERE is_default = true AND is_active = true
     LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_items_default_tax
  BEFORE INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_default_tax_master();

-- Seed the default 3% GST slab (1.5% CGST + 1.5% SGST, HSN 71131930)
WITH ins AS (
  INSERT INTO public.tax_masters
    (name, tax_type, description, hsn_code, is_active, is_default,
     apply_to_primary_orders, apply_to_secondary_orders)
  VALUES
    ('3% GST', 'GST',
     'Articles of jewellery and parts, gold set with diamonds',
     '71131930', true, true, true, true)
  RETURNING id
)
INSERT INTO public.tax_components (tax_master_id, component_type, percentage, is_enabled)
SELECT ins.id, c.component_type, c.percentage, c.is_enabled FROM ins
CROSS JOIN (VALUES
  ('CGST'::public.tax_component_type, 1.5::numeric, true),
  ('SGST'::public.tax_component_type, 1.5::numeric, true),
  ('IGST'::public.tax_component_type, 0::numeric, false),
  ('CESS'::public.tax_component_type, 0::numeric, false)
) AS c(component_type, percentage, is_enabled);

-- Backfill existing inventory items to the default slab
UPDATE public.inventory_items
   SET tax_master_id = (SELECT id FROM public.tax_masters WHERE is_default = true LIMIT 1)
 WHERE tax_master_id IS NULL;
