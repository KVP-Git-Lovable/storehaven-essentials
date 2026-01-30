CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles_master r ON p.role_id = r.id
    WHERE p.id = _user_id
      AND LOWER(r.name) IN ('admin', 'super admin')
  )
$function$;