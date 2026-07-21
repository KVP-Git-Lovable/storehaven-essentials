
CREATE TABLE public.diamond_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  particulars TEXT NOT NULL,
  size_label TEXT NOT NULL,
  price_per_ct NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (particulars, size_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diamond_rates TO authenticated;
GRANT ALL ON public.diamond_rates TO service_role;
ALTER TABLE public.diamond_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage diamond rates" ON public.diamond_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_diamond_rates_updated_at BEFORE UPDATE ON public.diamond_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.diamond_rates (particulars, size_label, price_per_ct, sort_order) VALUES
  ('ROUND/FANCY', '-2 TO 29 POINTER', 35000, 1),
  ('ROUND/FANCY', '30 TO 69 CENTS', 45000, 2),
  ('ROUND/FANCY', '70 TO 99 CENTS', 50000, 3),
  ('ROUND/FANCY', '1.00 CARAT', 55000, 4),
  ('ROUND/FANCY', '1.50 CARAT', 55000, 5),
  ('ROUND/FANCY', '2.00 CARAT', 60000, 6),
  ('ROUND/FANCY', '2.50 CARAT', 60000, 7),
  ('ROUND/FANCY', '3.00 CARAT', 60000, 8),
  ('ROUND/FANCY', '4.00 CARAT', 65000, 9),
  ('ROUND/FANCY', '5.00 CARAT', 70000, 10);

CREATE TABLE public.cs_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL UNIQUE,
  price_per_gram NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_rates TO authenticated;
GRANT ALL ON public.cs_rates TO service_role;
ALTER TABLE public.cs_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage cs rates" ON public.cs_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_cs_rates_updated_at BEFORE UPDATE ON public.cs_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
