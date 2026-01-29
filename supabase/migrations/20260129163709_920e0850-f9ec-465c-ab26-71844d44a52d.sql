
-- Create knowledge base articles table
CREATE TABLE public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  asset_master_id UUID REFERENCES public.asset_masters(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  keywords TEXT[] DEFAULT '{}',
  article_type TEXT NOT NULL DEFAULT 'guide',
  status TEXT NOT NULL DEFAULT 'active',
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for full-text search
CREATE INDEX idx_kb_articles_search ON public.knowledge_base_articles 
  USING GIN (to_tsvector('english', title || ' ' || content));

-- Create index for asset lookups
CREATE INDEX idx_kb_articles_asset ON public.knowledge_base_articles(asset_master_id);

-- Create index for category and type filtering
CREATE INDEX idx_kb_articles_category ON public.knowledge_base_articles(category, article_type);

-- Create index for keywords
CREATE INDEX idx_kb_articles_keywords ON public.knowledge_base_articles USING GIN(keywords);

-- Enable RLS
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to knowledge base"
  ON public.knowledge_base_articles
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to knowledge base"
  ON public.knowledge_base_articles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to knowledge base"
  ON public.knowledge_base_articles
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from knowledge base"
  ON public.knowledge_base_articles
  FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_knowledge_base_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function for full-text search
CREATE OR REPLACE FUNCTION public.search_knowledge_base(search_query TEXT)
RETURNS SETOF public.knowledge_base_articles
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.knowledge_base_articles
  WHERE status = 'active'
    AND (
      to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', search_query)
      OR title ILIKE '%' || search_query || '%'
      OR search_query = ANY(keywords)
    )
  ORDER BY 
    ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', search_query)) DESC,
    views_count DESC;
$$;
