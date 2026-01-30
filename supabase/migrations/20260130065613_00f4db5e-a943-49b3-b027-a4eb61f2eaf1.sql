-- Create user_permissions table for user-specific permission overrides
CREATE TABLE public.user_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_permissions
CREATE POLICY "Admins can view user permissions"
ON public.user_permissions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert user permissions"
ON public.user_permissions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update user permissions"
ON public.user_permissions
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete user permissions"
ON public.user_permissions
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update get_user_permissions function to merge role and user permissions
-- User permissions override role permissions (if set to true)
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(module_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(rp.module_key, up.module_key) as module_key,
    COALESCE(up.can_view, rp.can_view, false) as can_view,
    COALESCE(up.can_create, rp.can_create, false) as can_create,
    COALESCE(up.can_edit, rp.can_edit, false) as can_edit,
    COALESCE(up.can_delete, rp.can_delete, false) as can_delete
  FROM public.role_permissions rp
  FULL OUTER JOIN public.user_permissions up ON rp.module_key = up.module_key AND up.user_id = _user_id
  JOIN public.profiles p ON p.id = _user_id
  WHERE rp.role_id = p.role_id OR up.user_id = _user_id
$$;

-- Function to get only role permissions for a user (for display purposes)
CREATE OR REPLACE FUNCTION public.get_role_permissions_for_user(_user_id uuid)
RETURNS TABLE(module_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT rp.module_key, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
  FROM public.role_permissions rp
  JOIN public.profiles p ON p.role_id = rp.role_id
  WHERE p.id = _user_id
$$;