
-- Campaigns
CREATE TABLE public.email_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  html TEXT NOT NULL DEFAULT '',
  audience_config JSONB NOT NULL DEFAULT '{"segments":[],"combinator":"union"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','paused','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  sendgrid_single_send_id TEXT,
  sendgrid_list_id TEXT,
  sendgrid_import_job_id TEXT,
  last_error TEXT,
  audience_snapshot_count INTEGER DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  bounce_count INTEGER NOT NULL DEFAULT 0,
  spam_count INTEGER NOT NULL DEFAULT 0,
  unsubscribe_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  dropped_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_campaigns TO authenticated;
GRANT ALL ON public.email_marketing_campaigns TO service_role;
ALTER TABLE public.email_marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users read marketing campaigns" ON public.email_marketing_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users write marketing campaigns" ON public.email_marketing_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth users update marketing campaigns" ON public.email_marketing_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth users delete marketing campaigns" ON public.email_marketing_campaigns FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_emc_status ON public.email_marketing_campaigns(status);
CREATE INDEX idx_emc_scheduled_at ON public.email_marketing_campaigns(scheduled_at);
CREATE TRIGGER emc_updated_at BEFORE UPDATE ON public.email_marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recipients
CREATE TABLE public.email_marketing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_marketing_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  contact_ref JSONB,
  merge_vars JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_recipients TO authenticated;
GRANT ALL ON public.email_marketing_recipients TO service_role;
ALTER TABLE public.email_marketing_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage marketing recipients" ON public.email_marketing_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_emr_campaign ON public.email_marketing_recipients(campaign_id);
CREATE INDEX idx_emr_email ON public.email_marketing_recipients(email);

-- Events
CREATE TABLE public.email_marketing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_marketing_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  url TEXT,
  reason TEXT,
  sg_event_id TEXT UNIQUE,
  sg_message_id TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_events TO authenticated;
GRANT ALL ON public.email_marketing_events TO service_role;
ALTER TABLE public.email_marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users read marketing events" ON public.email_marketing_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "service role writes marketing events" ON public.email_marketing_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_eme_campaign ON public.email_marketing_events(campaign_id);
CREATE INDEX idx_eme_type ON public.email_marketing_events(event_type);
CREATE INDEX idx_eme_ts ON public.email_marketing_events(event_timestamp);

-- Templates
CREATE TABLE public.email_marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('welcome','promotions','offers','newsletters','followup','custom')),
  subject TEXT,
  preview_text TEXT,
  html TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_templates TO authenticated;
GRANT ALL ON public.email_marketing_templates TO service_role;
ALTER TABLE public.email_marketing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage marketing templates" ON public.email_marketing_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER emt_updated_at BEFORE UPDATE ON public.email_marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppressions
CREATE TABLE public.email_marketing_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'manual',
  campaign_id UUID REFERENCES public.email_marketing_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_suppressions TO authenticated;
GRANT ALL ON public.email_marketing_suppressions TO service_role;
ALTER TABLE public.email_marketing_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage marketing suppressions" ON public.email_marketing_suppressions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Test sends
CREATE TABLE public.email_marketing_test_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_marketing_campaigns(id) ON DELETE CASCADE,
  recipients TEXT[] NOT NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_marketing_test_sends TO authenticated;
GRANT ALL ON public.email_marketing_test_sends TO service_role;
ALTER TABLE public.email_marketing_test_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage marketing test sends" ON public.email_marketing_test_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);
