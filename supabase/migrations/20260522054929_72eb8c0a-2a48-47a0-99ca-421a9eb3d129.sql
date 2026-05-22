
-- WhatsApp pricing config
CREATE TABLE public.whatsapp_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL DEFAULT 'IN',
  category text NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION','FAILED_FEE')),
  service_window text NOT NULL DEFAULT 'n_a' CHECK (service_window IN ('inside','outside','n_a')),
  meta_fee_usd numeric(10,6) NOT NULL DEFAULT 0,
  twilio_fee_usd numeric(10,6) NOT NULL DEFAULT 0,
  effective_from timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_whatsapp_pricing_active
  ON public.whatsapp_pricing_config (region, category, service_window)
  WHERE is_active = true;

ALTER TABLE public.whatsapp_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pricing"
  ON public.whatsapp_pricing_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pricing"
  ON public.whatsapp_pricing_config FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update pricing"
  ON public.whatsapp_pricing_config FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete pricing"
  ON public.whatsapp_pricing_config FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_whatsapp_pricing_updated_at
  BEFORE UPDATE ON public.whatsapp_pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (per spec, IN region)
INSERT INTO public.whatsapp_pricing_config (region, category, service_window, meta_fee_usd, twilio_fee_usd, notes) VALUES
  ('IN','MARKETING','n_a',     0.0094, 0.005, 'Marketing — always charged'),
  ('IN','UTILITY','inside',    0.0000, 0.005, 'Utility inside 24h service window'),
  ('IN','UTILITY','outside',   0.0034, 0.005, 'Utility outside 24h service window'),
  ('IN','AUTHENTICATION','inside',  0.0000, 0.005, 'Auth inside 24h service window'),
  ('IN','AUTHENTICATION','outside', 0.0034, 0.005, 'Auth outside 24h service window'),
  ('IN','FAILED_FEE','n_a',    0.0010, 0.000, 'Failed message processing fee');

-- FX rates
CREATE TABLE public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL DEFAULT 'USD',
  to_currency text NOT NULL DEFAULT 'INR',
  rate numeric(12,6) NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','api','rbi','fallback')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fx_rates_active ON public.fx_rates (from_currency, to_currency, is_active, fetched_at DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view fx"
  ON public.fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert fx"
  ON public.fx_rates FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update fx"
  ON public.fx_rates FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete fx"
  ON public.fx_rates FOR DELETE TO authenticated USING (is_admin(auth.uid()));

INSERT INTO public.fx_rates (from_currency, to_currency, rate, source) VALUES ('USD','INR', 95.0, 'fallback');

-- Per-journey assumptions
CREATE TABLE public.journey_cost_settings (
  journey_id uuid PRIMARY KEY REFERENCES public.journeys(id) ON DELETE CASCADE,
  estimated_in_window_pct integer NOT NULL DEFAULT 0 CHECK (estimated_in_window_pct BETWEEN 0 AND 100),
  entry_point_type text NOT NULL DEFAULT 'normal' CHECK (entry_point_type IN ('normal','click_to_whatsapp','customer_initiated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view journey cost settings"
  ON public.journey_cost_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert journey cost settings"
  ON public.journey_cost_settings FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update journey cost settings"
  ON public.journey_cost_settings FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete journey cost settings"
  ON public.journey_cost_settings FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_journey_cost_settings_updated_at
  BEFORE UPDATE ON public.journey_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service window detection (read-only, used by analytics only)
CREATE OR REPLACE FUNCTION public.is_in_service_window(_phone text, _at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whatsapp_messages
    WHERE direction = 'inbound'
      AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
      AND created_at <= _at
      AND created_at >= _at - interval '24 hours'
  );
$$;
