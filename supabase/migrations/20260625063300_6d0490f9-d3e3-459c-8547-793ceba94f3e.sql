
-- Policies for whatsapp-videos bucket
CREATE POLICY "Public can read whatsapp videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-videos');

CREATE POLICY "Authenticated can upload whatsapp videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-videos');

CREATE POLICY "Authenticated can update whatsapp videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-videos');

CREATE POLICY "Authenticated can delete whatsapp videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-videos');
