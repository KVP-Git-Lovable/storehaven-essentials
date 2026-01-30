-- Drop existing functions if they exist (to recreate with correct signatures)
DROP FUNCTION IF EXISTS public.get_hierarchy_accessible_users(uuid);
DROP FUNCTION IF EXISTS public.is_subordinate(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_subordinate_user_ids(uuid);

-- Create recursive function to get all subordinate user IDs
CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE subordinates AS (
    -- Direct reports
    SELECT id FROM public.profiles WHERE reports_to = _user_id
    UNION ALL
    -- Nested subordinates
    SELECT p.id 
    FROM public.profiles p
    INNER JOIN subordinates s ON p.reports_to = s.id
  )
  SELECT id FROM subordinates;
$$;

-- Create helper function to check if a user is a subordinate of a manager
CREATE OR REPLACE FUNCTION public.is_subordinate(_manager_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_subordinate_user_ids(_manager_id) sub_id WHERE sub_id = _user_id
  )
$$;

-- Create function to get all accessible user IDs (self + subordinates)
CREATE OR REPLACE FUNCTION public.get_hierarchy_accessible_users(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Include self
  SELECT _user_id
  UNION
  -- Include all subordinates (the function returns uuid directly)
  SELECT sub_id FROM public.get_subordinate_user_ids(_user_id) AS sub_id;
$$;

-- Add index for better performance on reports_to lookups
CREATE INDEX IF NOT EXISTS idx_profiles_reports_to ON public.profiles(reports_to);