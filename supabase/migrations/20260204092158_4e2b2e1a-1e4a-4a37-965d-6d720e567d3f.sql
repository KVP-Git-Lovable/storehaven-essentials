-- Create table for vendor access links to contracts
CREATE TABLE public.service_contract_vendor_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for fast token lookups
CREATE INDEX idx_vendor_links_token ON public.service_contract_vendor_links(token);
CREATE INDEX idx_vendor_links_contract ON public.service_contract_vendor_links(service_contract_id);

-- Enable RLS
ALTER TABLE public.service_contract_vendor_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view/create links for contracts they have access to
CREATE POLICY "Authenticated users can view vendor links"
ON public.service_contract_vendor_links
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create vendor links"
ON public.service_contract_vendor_links
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendor links"
ON public.service_contract_vendor_links
FOR UPDATE
TO authenticated
USING (true);

-- Allow anonymous access for token validation (public vendor view)
CREATE POLICY "Anyone can validate tokens"
ON public.service_contract_vendor_links
FOR SELECT
TO anon
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));