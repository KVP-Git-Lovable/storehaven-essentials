-- Create permission_set_groups table
CREATE TABLE public.permission_set_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create permission_set_group_permissions table
CREATE TABLE public.permission_set_group_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.permission_set_groups(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (group_id, module_key)
);

-- Create user_permission_set_groups junction table
CREATE TABLE public.user_permission_set_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.permission_set_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

-- Enable RLS on all tables
ALTER TABLE public.permission_set_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_set_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_set_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for permission_set_groups (admin only)
CREATE POLICY "Admins can manage permission set groups" 
ON public.permission_set_groups 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- RLS policies for permission_set_group_permissions (admin only)
CREATE POLICY "Admins can manage permission set group permissions" 
ON public.permission_set_group_permissions 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- RLS policies for user_permission_set_groups (admin only)
CREATE POLICY "Admins can manage user permission set group assignments" 
ON public.user_permission_set_groups 
FOR ALL 
USING (public.is_admin(auth.uid()));

-- Add updated_at trigger to permission_set_groups
CREATE TRIGGER update_permission_set_groups_updated_at
BEFORE UPDATE ON public.permission_set_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update the get_user_permissions function to include group permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(module_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    combined.module_key,
    bool_or(combined.can_view) as can_view,
    bool_or(combined.can_create) as can_create,
    bool_or(combined.can_edit) as can_edit,
    bool_or(combined.can_delete) as can_delete
  FROM (
    -- Role permissions
    SELECT rp.module_key, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
    FROM public.role_permissions rp
    JOIN public.profiles p ON p.role_id = rp.role_id
    WHERE p.id = _user_id
    
    UNION ALL
    
    -- Permission set group permissions
    SELECT gp.module_key, gp.can_view, gp.can_create, gp.can_edit, gp.can_delete
    FROM public.permission_set_group_permissions gp
    JOIN public.user_permission_set_groups upg ON upg.group_id = gp.group_id
    JOIN public.permission_set_groups psg ON psg.id = gp.group_id
    WHERE upg.user_id = _user_id
      AND psg.status = 'active'
  ) combined
  GROUP BY combined.module_key
$$;