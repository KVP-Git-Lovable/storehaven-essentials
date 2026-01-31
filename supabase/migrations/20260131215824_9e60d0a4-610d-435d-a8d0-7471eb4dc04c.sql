-- =====================================================
-- POS ENHANCEMENTS: Pricing, Loyalty, Coupons, Gift Cards, Layaways
-- =====================================================

-- 1. PRICE RULES TABLE - Dynamic pricing linked to products
CREATE TABLE public.price_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('tiered', 'bundle', 'time_based', 'customer_segment', 'quantity_break')),
  priority INTEGER DEFAULT 0,
  product_ids UUID[] DEFAULT '{}',
  category_ids TEXT[] DEFAULT '{}',
  customer_segments TEXT[] DEFAULT '{}',
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'new_price')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  time_start TIME,
  time_end TIME,
  days_of_week INTEGER[] DEFAULT '{}',
  is_combinable BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price rules are viewable by authenticated users" 
ON public.price_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Price rules are manageable by authenticated users" 
ON public.price_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. COUPONS TABLE
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_purchase_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  applicable_product_ids UUID[] DEFAULT '{}',
  applicable_category_ids TEXT[] DEFAULT '{}',
  customer_id UUID REFERENCES public.customers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupons are viewable by authenticated users" 
ON public.coupons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coupons are manageable by authenticated users" 
ON public.coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. COUPON USAGE TRACKING
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  discount_amount NUMERIC NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupon usages are viewable by authenticated users" 
ON public.coupon_usages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Coupon usages are manageable by authenticated users" 
ON public.coupon_usages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. GIFT CARDS TABLE
CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_number TEXT NOT NULL UNIQUE,
  pin TEXT,
  initial_value NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  purchaser_customer_id UUID REFERENCES public.customers(id),
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  purchase_order_id UUID REFERENCES public.orders(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'depleted', 'expired')),
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift cards are viewable by authenticated users" 
ON public.gift_cards FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gift cards are manageable by authenticated users" 
ON public.gift_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. GIFT CARD TRANSACTIONS
CREATE TABLE public.gift_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('load', 'redeem', 'refund', 'adjust')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gift card transactions viewable by authenticated users" 
ON public.gift_card_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gift card transactions manageable by authenticated users" 
ON public.gift_card_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. LOYALTY PROGRAM CONFIGURATION
CREATE TABLE public.loyalty_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Default Loyalty Program',
  points_per_rupee NUMERIC NOT NULL DEFAULT 1,
  points_value_rupee NUMERIC NOT NULL DEFAULT 1,
  min_points_redeem INTEGER DEFAULT 100,
  max_points_per_transaction INTEGER,
  welcome_bonus_points INTEGER DEFAULT 0,
  birthday_bonus_points INTEGER DEFAULT 0,
  tier_multipliers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loyalty config viewable by authenticated users" 
ON public.loyalty_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loyalty config manageable by authenticated users" 
ON public.loyalty_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. LOYALTY TRANSACTIONS (Points history)
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'bonus', 'adjust', 'expire')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loyalty transactions viewable by authenticated users" 
ON public.loyalty_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loyalty transactions manageable by authenticated users" 
ON public.loyalty_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. LAYAWAYS TABLE
CREATE TABLE public.layaways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layaway_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  store_id UUID REFERENCES public.stores(id),
  total_amount NUMERIC NOT NULL,
  deposit_amount NUMERIC NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  balance_due NUMERIC GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  payment_due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'forfeited')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.layaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Layaways viewable by authenticated users" 
ON public.layaways FOR SELECT TO authenticated USING (true);

CREATE POLICY "Layaways manageable by authenticated users" 
ON public.layaways FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. LAYAWAY ITEMS
CREATE TABLE public.layaway_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layaway_id UUID NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.layaway_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Layaway items viewable by authenticated users" 
ON public.layaway_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Layaway items manageable by authenticated users" 
ON public.layaway_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. LAYAWAY PAYMENTS
CREATE TABLE public.layaway_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layaway_id UUID NOT NULL REFERENCES public.layaways(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  received_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.layaway_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Layaway payments viewable by authenticated users" 
ON public.layaway_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Layaway payments manageable by authenticated users" 
ON public.layaway_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. PERSONALIZED OFFERS
CREATE TABLE public.personalized_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('basket_based', 'customer_segment', 'product_recommendation', 'upsell', 'cross_sell')),
  trigger_conditions JSONB DEFAULT '{}',
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free_item')),
  discount_value NUMERIC,
  product_ids UUID[] DEFAULT '{}',
  display_message TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.personalized_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personalized offers viewable by authenticated users" 
ON public.personalized_offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Personalized offers manageable by authenticated users" 
ON public.personalized_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. Enhance schemes table with more discount types
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'order' CHECK (applies_to IN ('order', 'product', 'category'));
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS applicable_categories TEXT[] DEFAULT '{}';
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC;
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS is_auto_apply BOOLEAN DEFAULT true;
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS store_ids UUID[] DEFAULT '{}';
ALTER TABLE public.schemes ADD COLUMN IF NOT EXISTS customer_segments TEXT[] DEFAULT '{}';

-- Update discount_type constraint to allow more types
-- We can't alter CHECK constraints directly, so we use a workaround
-- The discount_type already exists as TEXT, we'll handle validation in app

-- 13. Add coupon and scheme tracking to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheme_ids UUID[] DEFAULT '{}';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES public.gift_cards(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift_card_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'sale' CHECK (order_type IN ('sale', 'return', 'exchange', 'layaway'));

-- 14. Add customer segments and preferences
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_segment TEXT DEFAULT 'regular';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS anniversary_date DATE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));

-- Insert default loyalty config
INSERT INTO public.loyalty_config (name, points_per_rupee, points_value_rupee, min_points_redeem, welcome_bonus_points)
VALUES ('Default Loyalty Program', 1, 1, 100, 50)
ON CONFLICT DO NOTHING;

-- Create updated_at triggers
CREATE TRIGGER update_price_rules_updated_at BEFORE UPDATE ON public.price_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_config_updated_at BEFORE UPDATE ON public.loyalty_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_layaways_updated_at BEFORE UPDATE ON public.layaways
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personalized_offers_updated_at BEFORE UPDATE ON public.personalized_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();