
CREATE TABLE public.making_charges_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL UNIQUE,
  price_per_gram NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.making_charges_rates TO authenticated;
GRANT ALL ON public.making_charges_rates TO service_role;
ALTER TABLE public.making_charges_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read making rates" ON public.making_charges_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert making rates" ON public.making_charges_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update making rates" ON public.making_charges_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete making rates" ON public.making_charges_rates FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_making_charges_rates_updated_at BEFORE UPDATE ON public.making_charges_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
