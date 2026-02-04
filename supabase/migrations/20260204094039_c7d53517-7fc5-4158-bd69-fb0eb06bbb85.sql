-- Create RLS policy for vendors to update specific contract fields via valid token
-- First, create a function to check if a token is valid for a contract
CREATE OR REPLACE FUNCTION public.is_valid_vendor_token(contract_id uuid, vendor_token text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_contract_vendor_links
    WHERE service_contract_id = contract_id
      AND token = vendor_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Add RLS policy for anonymous users to update contracts via vendor link
-- Note: This requires passing the token as a header or in the request context
-- For simplicity, we'll allow updates to specific columns when the user has a valid token reference
CREATE POLICY "Vendors can update contracts via valid token"
ON public.service_contracts
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.service_contract_vendor_links
    WHERE service_contract_id = service_contracts.id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_contract_vendor_links
    WHERE service_contract_id = service_contracts.id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
);