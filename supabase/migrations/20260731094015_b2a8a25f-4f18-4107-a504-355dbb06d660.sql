-- Meta / social marketing module (platform-agnostic for future networks)

CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'meta',
  external_user_id text,
  external_user_name text,
  business_id text,
  business_name text,
  access_token_enc text,
  token_expires_at timestamptz,
  scopes text[],
  default_page_id text,
  default_instagram_id text,
  default_ad_account_id text,
  status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamptz,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  page_id text NOT NULL,
  page_name text,
  category text,
  picture_url text,
  page_token_enc text,
  instagram_id text,
  instagram_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, page_id)
);

CREATE TABLE public.social_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  ad_account_id text NOT NULL,
  name text,
  currency text,
  timezone_name text,
  account_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, ad_account_id)
);

CREATE TABLE public.social_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'meta',
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  ad_account_id text,
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'awareness',
  buying_type text NOT NULL DEFAULT 'auction',
  budget_type text NOT NULL DEFAULT 'daily',
  budget_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  special_ad_categories text[] NOT NULL DEFAULT '{}',
  start_date timestamptz,
  end_date timestamptz,
  external_id text,
  published_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_ad_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.social_campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  name text NOT NULL,
  page_id text,
  instagram_id text,
  budget_type text NOT NULL DEFAULT 'daily',
  budget_amount numeric NOT NULL DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  timezone_name text,
  placements jsonb NOT NULL DEFAULT '[]'::jsonb,
  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  optimization_goal text,
  billing_event text,
  bid_strategy text,
  status text NOT NULL DEFAULT 'paused',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id uuid NOT NULL REFERENCES public.social_ad_sets(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  name text NOT NULL,
  creative_type text NOT NULL DEFAULT 'single_image',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  headline text,
  primary_text text,
  description text,
  destination_url text,
  display_link text,
  call_to_action text,
  lead_form_id text,
  utm_parameters text,
  status text NOT NULL DEFAULT 'draft',
  external_id text,
  creative_external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'meta',
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  post_type text NOT NULL DEFAULT 'text',
  message text,
  media_url text,
  destination text NOT NULL DEFAULT 'facebook',
  page_id text,
  instagram_id text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  facebook_post_id text,
  instagram_post_id text,
  error_message text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'meta',
  entity_type text NOT NULL,
  entity_id uuid,
  external_id text,
  stat_date date NOT NULL,
  reach bigint NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  leads bigint NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, stat_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ad_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ad_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_insights TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
GRANT ALL ON public.social_pages TO service_role;
GRANT ALL ON public.social_ad_accounts TO service_role;
GRANT ALL ON public.social_campaigns TO service_role;
GRANT ALL ON public.social_ad_sets TO service_role;
GRANT ALL ON public.social_ads TO service_role;
GRANT ALL ON public.social_posts TO service_role;
GRANT ALL ON public.social_insights TO service_role;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read social connections" ON public.social_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage social connections" ON public.social_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social pages" ON public.social_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social ad accounts" ON public.social_ad_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social campaigns" ON public.social_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social ad sets" ON public.social_ad_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social ads" ON public.social_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social posts" ON public.social_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage social insights" ON public.social_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_social_connections_updated BEFORE UPDATE ON public.social_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_pages_updated BEFORE UPDATE ON public.social_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_ad_accounts_updated BEFORE UPDATE ON public.social_ad_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_campaigns_updated BEFORE UPDATE ON public.social_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_ad_sets_updated BEFORE UPDATE ON public.social_ad_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_ads_updated BEFORE UPDATE ON public.social_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_posts_updated BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_social_insights_updated BEFORE UPDATE ON public.social_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();