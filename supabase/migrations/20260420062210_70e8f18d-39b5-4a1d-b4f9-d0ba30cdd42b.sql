-- Create list_views table
CREATE TABLE public.list_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  entity_type text NOT NULL,
  selected_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'private',
  tags text[] DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT list_views_entity_check CHECK (entity_type IN ('customers','orders','revenue','products','items','schemes')),
  CONSTRAINT list_views_visibility_check CHECK (visibility IN ('private','shared'))
);

ALTER TABLE public.list_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "List views: view shared or own or admin"
ON public.list_views FOR SELECT
TO authenticated
USING (
  visibility = 'shared'
  OR created_by = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY "List views: insert own"
ON public.list_views FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "List views: update own or admin"
ON public.list_views FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "List views: delete own or admin"
ON public.list_views FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_list_views_updated_at
BEFORE UPDATE ON public.list_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add list_view_id to journeys (coexists with legacy segment_type)
ALTER TABLE public.journeys
ADD COLUMN list_view_id uuid REFERENCES public.list_views(id) ON DELETE SET NULL;

CREATE INDEX idx_journeys_list_view_id ON public.journeys(list_view_id);
CREATE INDEX idx_list_views_entity ON public.list_views(entity_type);
CREATE INDEX idx_list_views_created_by ON public.list_views(created_by);