import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyInfo {
  id: string;
  company_name: string;
  logo_url: string | null;
  tagline: string | null;
  industry: string | null;
  company_type: string | null;
  registration_number: string | null;
  tax_id: string | null;
  gst_number: string | null;
  pan_number: string | null;
  founded_date: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  fax: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  timezone: string | null;
  currency: string | null;
  fiscal_year_start: string | null;
  number_of_employees: number | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  about: string | null;
}

export function useCompanyInfo() {
  return useQuery({
    queryKey: ["company-information"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_information")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CompanyInfo | null;
    },
  });
}
