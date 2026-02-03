-- Make storage bucket public for profile photos to render correctly
-- The employee-documents bucket is currently private, which prevents avatars from loading

-- First, update the bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'employee-documents';

-- Add RLS policy to allow authenticated users to read their own profile photos
CREATE POLICY "Users can view profile photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents' 
  AND (storage.foldername(name))[1] = 'profile-photos'
);

-- Policy for users to upload their own profile photos
CREATE POLICY "Users can upload own profile photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND (storage.foldername(name))[1] = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy for users to update their own profile photos
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-documents' 
  AND (storage.foldername(name))[1] = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy for users to delete their own profile photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents' 
  AND (storage.foldername(name))[1] = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);