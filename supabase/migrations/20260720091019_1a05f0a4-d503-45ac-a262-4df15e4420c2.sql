CREATE TABLE public.gold_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date date NOT NULL,
  karat text NOT NULL CHECK (karat IN ('18K','22K')),
  price_per_gram numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rate_date, karat)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_rates TO authenticated;
GRANT ALL ON public.gold_rates TO service_role;

ALTER TABLE public.gold_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read gold_rates" ON public.gold_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert gold_rates" ON public.gold_rates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update gold_rates" ON public.gold_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete gold_rates" ON public.gold_rates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_gold_rates_updated_at BEFORE UPDATE ON public.gold_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add discount_amount to orders if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;