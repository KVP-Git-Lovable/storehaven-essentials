-- Add profile photo column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Add face verification status to attendance_records
ALTER TABLE public.attendance_records 
ADD COLUMN IF NOT EXISTS face_verification_status TEXT DEFAULT 'pending' 
CHECK (face_verification_status IN ('pending', 'verifying', 'matched', 'mismatch'));

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.profile_photo_url IS 'URL of the user profile photo used for face verification';
COMMENT ON COLUMN public.attendance_records.face_verification_status IS 'Status of face verification: pending, verifying, matched, mismatch';