-- Create public bucket for WhatsApp template media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access (Twilio/Meta must fetch these URLs)
CREATE POLICY "WhatsApp media are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Authenticated users may upload into a folder named after their user id
CREATE POLICY "Authenticated users can upload WhatsApp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update/delete their own files
CREATE POLICY "Users can update their own WhatsApp media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own WhatsApp media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);