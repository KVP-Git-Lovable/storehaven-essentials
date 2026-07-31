CREATE POLICY "Public can view social media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-media');

CREATE POLICY "Authenticated can upload social media files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'social-media');

CREATE POLICY "Authenticated can update social media files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'social-media');

CREATE POLICY "Authenticated can delete social media files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'social-media');