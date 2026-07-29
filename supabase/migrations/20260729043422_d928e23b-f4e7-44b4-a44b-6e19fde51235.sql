CREATE POLICY "Authenticated can read invoices" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices');
CREATE POLICY "Authenticated can upload invoices" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices');
CREATE POLICY "Authenticated can update invoices" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');
CREATE POLICY "Service role manages invoices" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');