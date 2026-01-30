-- Add manager_id column to stores table (references profiles)
ALTER TABLE public.stores ADD COLUMN manager_id uuid REFERENCES public.profiles(id);

-- Create function to sync manager access to store_user_access table
CREATE OR REPLACE FUNCTION public.sync_store_manager_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On UPDATE: Remove old manager's access if manager changed
  IF TG_OP = 'UPDATE' AND OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
    IF OLD.manager_id IS NOT NULL THEN
      DELETE FROM public.store_user_access 
      WHERE store_id = OLD.id AND user_id = OLD.manager_id;
    END IF;
  END IF;
  
  -- Add new manager access (for both INSERT and UPDATE)
  IF NEW.manager_id IS NOT NULL THEN
    INSERT INTO public.store_user_access (store_id, user_id)
    VALUES (NEW.id, NEW.manager_id)
    ON CONFLICT (store_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic store access sync
DROP TRIGGER IF EXISTS store_manager_access_sync ON public.stores;
CREATE TRIGGER store_manager_access_sync
  AFTER INSERT OR UPDATE OF manager_id ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_store_manager_access();