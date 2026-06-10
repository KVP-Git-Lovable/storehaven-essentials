
CREATE OR REPLACE FUNCTION public.get_users_for_management(_viewer_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  role_id uuid,
  reports_to uuid,
  status text,
  role_name text,
  manager_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.email,
    p.role_id,
    p.reports_to,
    p.status,
    r.name AS role_name,
    mgr.username AS manager_name
  FROM public.profiles p
  LEFT JOIN public.user_roles_master r ON r.id = p.role_id
  LEFT JOIN public.profiles mgr ON mgr.id = p.reports_to
  WHERE
    public.is_admin(_viewer_id)
    OR EXISTS (
      SELECT 1
      FROM public.get_user_permissions(_viewer_id) gp
      WHERE gp.module_key IN ('usermanagement', 'usermanagement.users')
        AND gp.can_view = true
    )
  ORDER BY p.username;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_for_management(uuid) TO authenticated;
