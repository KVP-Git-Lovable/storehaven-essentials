-- Add new columns to knowledge_base_articles for videos and SME
ALTER TABLE public.knowledge_base_articles 
ADD COLUMN IF NOT EXISTS video_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sme_names text[] DEFAULT '{}';

-- Create junction table for multi-select asset masters (replacing single asset_master_id)
CREATE TABLE public.kb_article_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  asset_master_id uuid NOT NULL REFERENCES public.asset_masters(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(article_id, asset_master_id)
);

-- Create junction table for linked vendors (OEM/Service providers)
CREATE TABLE public.kb_article_vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_role text NOT NULL DEFAULT 'vendor', -- 'oem' or 'vendor'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(article_id, vendor_id)
);

-- Create table for KB article attachments (documents)
CREATE TABLE public.kb_article_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by text
);

-- Enable RLS
ALTER TABLE public.kb_article_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_article_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for kb_article_assets
CREATE POLICY "Public read access for kb_article_assets"
ON public.kb_article_assets FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage kb_article_assets"
ON public.kb_article_assets FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create RLS policies for kb_article_vendors
CREATE POLICY "Public read access for kb_article_vendors"
ON public.kb_article_vendors FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage kb_article_vendors"
ON public.kb_article_vendors FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create RLS policies for kb_article_attachments
CREATE POLICY "Public read access for kb_article_attachments"
ON public.kb_article_attachments FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage kb_article_attachments"
ON public.kb_article_attachments FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_kb_article_assets_article_id ON public.kb_article_assets(article_id);
CREATE INDEX idx_kb_article_assets_asset_master_id ON public.kb_article_assets(asset_master_id);
CREATE INDEX idx_kb_article_vendors_article_id ON public.kb_article_vendors(article_id);
CREATE INDEX idx_kb_article_vendors_vendor_id ON public.kb_article_vendors(vendor_id);
CREATE INDEX idx_kb_article_attachments_article_id ON public.kb_article_attachments(article_id);

-- Create a storage bucket for KB attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kb-attachments', 'kb-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for KB attachments
CREATE POLICY "Public read access for kb-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'kb-attachments');

CREATE POLICY "Authenticated users can upload kb-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kb-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update kb-attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kb-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete kb-attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'kb-attachments' AND auth.uid() IS NOT NULL);