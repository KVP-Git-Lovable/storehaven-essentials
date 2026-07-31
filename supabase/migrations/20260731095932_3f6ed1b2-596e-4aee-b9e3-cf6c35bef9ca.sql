INSERT INTO public.role_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
SELECT r.id, k.module_key, true, true, true, true
FROM public.user_roles_master r
CROSS JOIN (VALUES
  ('communication.meta'),
  ('communication.meta.connection'),
  ('communication.meta.campaigns'),
  ('communication.meta.organic')
) AS k(module_key)
WHERE r.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.module_key = k.module_key
  );