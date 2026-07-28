CREATE TABLE public.gold_buy_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL UNIQUE,
  price_per_gram_24k numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_buy_rates TO authenticated;
GRANT ALL ON public.gold_buy_rates TO service_role;

ALTER TABLE public.gold_buy_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view gold buy rates" ON public.gold_buy_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert gold buy rates" ON public.gold_buy_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update gold buy rates" ON public.gold_buy_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete gold buy rates" ON public.gold_buy_rates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_gold_buy_rates_updated_at
BEFORE UPDATE ON public.gold_buy_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();