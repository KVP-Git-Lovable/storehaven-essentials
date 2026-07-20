import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceTemplate {
  id: string;
  company_name_override: string | null;
  tagline_override: string | null;
  invoice_title: string;
  show_logo: boolean;
  show_gst: boolean;
  show_pan: boolean;
  show_cin: boolean;
  show_phone: boolean;
  show_address: boolean;
  show_bank_details: boolean;
  invoice_prefix: string;
  next_invoice_number: number;
  invoice_number_padding: number;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_branch: string | null;
  bank_rtgs_ifsc: string | null;
  sgst_rate: number;
  cgst_rate: number;
  igst_rate: number;
  default_hsn_code: string | null;
  color_primary: string;
  color_accent: string;
  font_family: string;
  terms_and_conditions: string | null;
  footer_note: string | null;
  authorised_signatory_label: string | null;
  signature_url: string | null;
  seal_url: string | null;
}

export function useInvoiceTemplate() {
  return useQuery({
    queryKey: ["invoice-template"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_templates")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as InvoiceTemplate | null;
    },
  });
}