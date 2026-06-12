DROP POLICY IF EXISTS "Admins can delete journeys" ON public.journeys;
CREATE POLICY "Authenticated users can delete journeys" ON public.journeys FOR DELETE TO authenticated USING (true);