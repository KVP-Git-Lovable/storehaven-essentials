-- Add new fields for Do's, Don'ts, and Process Steps to knowledge_base_articles
ALTER TABLE public.knowledge_base_articles 
ADD COLUMN IF NOT EXISTS dos TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS donts TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS process_steps TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMP WITH TIME ZONE;