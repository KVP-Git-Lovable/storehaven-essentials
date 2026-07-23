CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id text UNIQUE,
  title text NOT NULL,
  vendor text,
  product_type text,
  handle text UNIQUE,
  image_url text,
  description text,
  display_price text,
  base_price numeric,
  compare_at_price numeric,
  published_at timestamptz,
  tags text[] DEFAULT ARRAY[]::text[],
  options jsonb DEFAULT '{}'::jsonb,
  variants jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalog" ON public.catalog_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert catalog" ON public.catalog_products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update catalog" ON public.catalog_products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete catalog" ON public.catalog_products
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_catalog_products_type ON public.catalog_products(product_type);
CREATE INDEX idx_catalog_products_handle ON public.catalog_products(handle);