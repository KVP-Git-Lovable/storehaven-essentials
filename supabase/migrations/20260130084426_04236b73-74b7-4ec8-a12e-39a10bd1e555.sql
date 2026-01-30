-- Create store_user_access table to control which users can see which stores
CREATE TABLE public.store_user_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- Enable RLS
ALTER TABLE public.store_user_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own access records
CREATE POLICY "Users can view their store access"
ON public.store_user_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Admins can manage store access
CREATE POLICY "Admins can manage store access"
ON public.store_user_access
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Insert access records for Bharath Mall (store: 51fede4f-86a0-43a8-b840-1b49ea6798c8)
-- For ganesh7718@gmail.com (user: 56a1c599-4b39-4ca0-bad5-35b155c0116c)
INSERT INTO public.store_user_access (store_id, user_id)
VALUES ('51fede4f-86a0-43a8-b840-1b49ea6798c8', '56a1c599-4b39-4ca0-bad5-35b155c0116c');

-- For abhishek.s@kvpcorp.com (user: f9b792fa-a330-45e2-851c-01bd04eca6a3)
INSERT INTO public.store_user_access (store_id, user_id)
VALUES ('51fede4f-86a0-43a8-b840-1b49ea6798c8', 'f9b792fa-a330-45e2-851c-01bd04eca6a3');

-- Add is_restricted column to stores to mark stores with restricted visibility
ALTER TABLE public.stores ADD COLUMN is_restricted BOOLEAN NOT NULL DEFAULT false;

-- Mark Bharath Mall as restricted
UPDATE public.stores SET is_restricted = true WHERE id = '51fede4f-86a0-43a8-b840-1b49ea6798c8';

-- Set up user permissions for ganesh7718@gmail.com (only Dashboard and Utilities)
-- First delete any existing permissions for this user
DELETE FROM public.user_permissions WHERE user_id = '56a1c599-4b39-4ca0-bad5-35b155c0116c';

-- Insert only Dashboard and Utilities permissions
INSERT INTO public.user_permissions (user_id, module_key, can_view, can_create, can_edit, can_delete)
VALUES 
  ('56a1c599-4b39-4ca0-bad5-35b155c0116c', 'dashboard', true, false, false, false),
  ('56a1c599-4b39-4ca0-bad5-35b155c0116c', 'utilities', true, true, true, false),
  ('56a1c599-4b39-4ca0-bad5-35b155c0116c', 'stores', true, false, false, false);