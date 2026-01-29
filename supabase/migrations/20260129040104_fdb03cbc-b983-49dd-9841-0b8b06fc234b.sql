-- Add parent_id column for self-referential hierarchy
ALTER TABLE public.categories 
ADD COLUMN parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for efficient tree queries
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);