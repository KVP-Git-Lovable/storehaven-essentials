
-- Invoice templates (singleton row per workspace)
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name_override TEXT,
  tagline_override TEXT,
  invoice_title TEXT NOT NULL DEFAULT 'TAX INVOICE',
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_gst BOOLEAN NOT NULL DEFAULT true,
  show_pan BOOLEAN NOT NULL DEFAULT true,
  show_cin BOOLEAN NOT NULL DEFAULT true,
  show_phone BOOLEAN NOT NULL DEFAULT true,
  show_address BOOLEAN NOT NULL DEFAULT true,
  show_bank_details BOOLEAN NOT NULL DEFAULT true,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  invoice_number_padding INTEGER NOT NULL DEFAULT 4,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_branch TEXT,
  bank_rtgs_ifsc TEXT,
  sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  igst_rate NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  default_hsn_code TEXT DEFAULT '71131930',
  color_primary TEXT NOT NULL DEFAULT '#7A1E2B',
  color_accent TEXT NOT NULL DEFAULT '#C9A961',
  font_family TEXT NOT NULL DEFAULT 'serif',
  terms_and_conditions TEXT,
  footer_note TEXT,
  authorised_signatory_label TEXT DEFAULT 'Authorised Signatory',
  signature_url TEXT,
  seal_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_templates TO authenticated;
GRANT ALL ON public.invoice_templates TO service_role;

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view invoice template"
  ON public.invoice_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert invoice template"
  ON public.invoice_templates FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update invoice template"
  ON public.invoice_templates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete invoice template"
  ON public.invoice_templates FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add invoice_number & invoice_generated_at to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_unique
  ON public.orders (invoice_number)
  WHERE invoice_number IS NOT NULL;

-- Allocate next invoice number atomically using the singleton template
CREATE OR REPLACE FUNCTION public.allocate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl RECORD;
  next_num INTEGER;
  formatted TEXT;
BEGIN
  SELECT id, invoice_prefix, next_invoice_number, invoice_number_padding
    INTO tpl
  FROM public.invoice_templates
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF tpl IS NULL THEN
    INSERT INTO public.invoice_templates DEFAULT VALUES
    RETURNING id, invoice_prefix, next_invoice_number, invoice_number_padding INTO tpl;
  END IF;

  next_num := tpl.next_invoice_number;
  formatted := tpl.invoice_prefix || LPAD(next_num::text, GREATEST(tpl.invoice_number_padding, 1), '0');

  UPDATE public.invoice_templates
     SET next_invoice_number = next_num + 1,
         updated_at = now()
   WHERE id = tpl.id;

  RETURN formatted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_invoice_number() TO authenticated;
