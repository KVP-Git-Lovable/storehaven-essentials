-- Update get_user_permissions to use additive logic (OR) instead of override (COALESCE)
-- This allows user-level permissions to ADD to role permissions rather than override them
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
 RETURNS TABLE(module_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(rp.module_key, up.module_key) as module_key,
    COALESCE(rp.can_view, false) OR COALESCE(up.can_view, false) as can_view,
    COALESCE(rp.can_create, false) OR COALESCE(up.can_create, false) as can_create,
    COALESCE(rp.can_edit, false) OR COALESCE(up.can_edit, false) as can_edit,
    COALESCE(rp.can_delete, false) OR COALESCE(up.can_delete, false) as can_delete
  FROM public.role_permissions rp
  FULL OUTER JOIN public.user_permissions up ON rp.module_key = up.module_key AND up.user_id = _user_id
  JOIN public.profiles p ON p.id = _user_id
  WHERE rp.role_id = p.role_id OR up.user_id = _user_id
$$;