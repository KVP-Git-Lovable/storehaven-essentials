
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS image_url TEXT;

DROP POLICY IF EXISTS "Public read inventory images" ON storage.objects;
CREATE POLICY "Public read inventory images" ON storage.objects
  FOR SELECT USING (bucket_id = 'inventory-images');

DROP POLICY IF EXISTS "Authenticated upload inventory images" ON storage.objects;
CREATE POLICY "Authenticated upload inventory images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'inventory-images');

DROP POLICY IF EXISTS "Authenticated update inventory images" ON storage.objects;
CREATE POLICY "Authenticated update inventory images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'inventory-images');

DROP POLICY IF EXISTS "Authenticated delete inventory images" ON storage.objects;
CREATE POLICY "Authenticated delete inventory images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'inventory-images');
