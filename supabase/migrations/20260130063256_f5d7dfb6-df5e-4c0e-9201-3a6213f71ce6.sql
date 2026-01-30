-- Add must_reset_password flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_reset_password boolean DEFAULT false;

-- Update existing users to not require password reset
UPDATE public.profiles SET must_reset_password = false WHERE must_reset_password IS NULL;