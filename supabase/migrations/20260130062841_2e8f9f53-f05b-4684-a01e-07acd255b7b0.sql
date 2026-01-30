-- Drop existing policies and recreate with proper security definer function
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles_master;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles_master;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles_master;

-- Recreate policies with explicit function call
CREATE POLICY "Admins can insert roles" 
ON public.user_roles_master 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" 
ON public.user_roles_master 
FOR UPDATE 
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" 
ON public.user_roles_master 
FOR DELETE 
TO authenticated
USING (public.is_admin(auth.uid()));