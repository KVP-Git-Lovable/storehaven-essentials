-- Create Sq Ft Budget Master table
CREATE TABLE public.sqft_budget_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  price_per_sqft NUMERIC(12,2) NOT NULL CHECK (price_per_sqft >= 0),
  effective_from DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sqft_budget_master ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view sqft budget master"
ON public.sqft_budget_master
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sqft budget master"
ON public.sqft_budget_master
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sqft budget master"
ON public.sqft_budget_master
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete sqft budget master"
ON public.sqft_budget_master
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_sqft_budget_master_updated_at
BEFORE UPDATE ON public.sqft_budget_master
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();