
-- Create company_information table (singleton - one row per tenant)
CREATE TABLE public.company_information (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  tagline TEXT,
  industry TEXT,
  company_type TEXT,
  registration_number TEXT,
  tax_id TEXT,
  gst_number TEXT,
  pan_number TEXT,
  founded_date DATE,
  website TEXT,
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  fax TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  currency TEXT DEFAULT 'INR',
  fiscal_year_start TEXT DEFAULT 'April',
  number_of_employees INTEGER,
  linkedin_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  about TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_information ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view company info
CREATE POLICY "Authenticated users can view company info"
ON public.company_information FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can update company info
CREATE POLICY "Admins can insert company info"
ON public.company_information FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update company info"
ON public.company_information FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete company info"
ON public.company_information FOR DELETE
USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_information_updated_at
BEFORE UPDATE ON public.company_information
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Storage policies for company assets
CREATE POLICY "Company assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-assets' AND auth.uid() IS NOT NULL);
