GRANT SELECT ON public.catalog_products TO anon;
CREATE POLICY "Public can view active catalog"
  ON public.catalog_products FOR SELECT
  TO anon
  USING (status = 'active');