import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Building2, Globe, MapPin, Phone, Mail, Calendar, Users, Upload, Loader2, Save, Linkedin, Facebook, Instagram, Twitter } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CompanyFormData {
  company_name: string;
  logo_url: string | null;
  tagline: string;
  industry: string;
  company_type: string;
  registration_number: string;
  tax_id: string;
  gst_number: string;
  pan_number: string;
  founded_date: string;
  website: string;
  email: string;
  phone: string;
  secondary_phone: string;
  fax: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  timezone: string;
  currency: string;
  fiscal_year_start: string;
  number_of_employees: number | null;
  linkedin_url: string;
  facebook_url: string;
  instagram_url: string;
  twitter_url: string;
  about: string;
}

const defaultForm: CompanyFormData = {
  company_name: "",
  logo_url: null,
  tagline: "",
  industry: "",
  company_type: "",
  registration_number: "",
  tax_id: "",
  gst_number: "",
  pan_number: "",
  founded_date: "",
  website: "",
  email: "",
  phone: "",
  secondary_phone: "",
  fax: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  country: "India",
  postal_code: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  fiscal_year_start: "April",
  number_of_employees: null,
  linkedin_url: "",
  facebook_url: "",
  instagram_url: "",
  twitter_url: "",
  about: "",
};

const industryOptions = [
  "Retail", "Food & Beverage", "Fashion & Apparel", "Electronics", "Healthcare",
  "Education", "Manufacturing", "Real Estate", "Hospitality", "Automotive",
  "FMCG", "Telecom", "Banking & Finance", "IT & Software", "Other",
];

const companyTypeOptions = [
  "Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship",
  "One Person Company", "Section 8 Company", "Franchise", "Other",
];

const currencyOptions = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

const timezoneOptions = [
  "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "Europe/London",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
];

const monthOptions = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompanyInformation() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CompanyFormData>(defaultForm);
  const [uploading, setUploading] = useState(false);

  const { data: companyInfo, isLoading } = useQuery({
    queryKey: ["company-information"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_information")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (companyInfo) {
      setForm({
        company_name: companyInfo.company_name || "",
        logo_url: companyInfo.logo_url,
        tagline: companyInfo.tagline || "",
        industry: companyInfo.industry || "",
        company_type: companyInfo.company_type || "",
        registration_number: companyInfo.registration_number || "",
        tax_id: companyInfo.tax_id || "",
        gst_number: companyInfo.gst_number || "",
        pan_number: companyInfo.pan_number || "",
        founded_date: companyInfo.founded_date || "",
        website: companyInfo.website || "",
        email: companyInfo.email || "",
        phone: companyInfo.phone || "",
        secondary_phone: companyInfo.secondary_phone || "",
        fax: companyInfo.fax || "",
        address_line1: companyInfo.address_line1 || "",
        address_line2: companyInfo.address_line2 || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        country: companyInfo.country || "India",
        postal_code: companyInfo.postal_code || "",
        timezone: companyInfo.timezone || "Asia/Kolkata",
        currency: companyInfo.currency || "INR",
        fiscal_year_start: companyInfo.fiscal_year_start || "April",
        number_of_employees: companyInfo.number_of_employees,
        linkedin_url: companyInfo.linkedin_url || "",
        facebook_url: companyInfo.facebook_url || "",
        instagram_url: companyInfo.instagram_url || "",
        twitter_url: companyInfo.twitter_url || "",
        about: companyInfo.about || "",
      });
    }
  }, [companyInfo]);

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const payload = {
        ...data,
        number_of_employees: data.number_of_employees || null,
        founded_date: data.founded_date || null,
      };

      if (companyInfo?.id) {
        const { error } = await supabase
          .from("company_information")
          .update(payload)
          .eq("id", companyInfo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_information")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-information"] });
      toast.success("Company information saved successfully");
    },
    onError: (error) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `company-logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    saveMutation.mutate(form);
  };

  const updateField = (field: keyof CompanyFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Information</h1>
          <p className="text-muted-foreground">Manage your organization's details and branding</p>
        </div>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo & Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Branding & Identity
            </CardTitle>
            <CardDescription>Your company logo and brand information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={form.logo_url || undefined} alt="Company Logo" />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {form.company_name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploading ? "Uploading..." : "Upload Logo"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </Button>
                  {form.logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateField("logo_url", null)}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Recommended: 200×200px, PNG or SVG, max 2MB</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input id="company_name" value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Enter company name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" value={form.tagline} onChange={(e) => updateField("tagline", e.target.value)} placeholder="Your company tagline" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={form.industry} onValueChange={(v) => updateField("industry", v)}>
                  <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company Type</Label>
                <Select value={form.company_type} onValueChange={(v) => updateField("company_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {companyTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="about">About Company</Label>
              <Textarea id="about" value={form.about} onChange={(e) => updateField("about", e.target.value)} placeholder="Brief description of your company..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Registration & Tax */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Registration & Tax Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registration_number">Registration Number (CIN)</Label>
                <Input id="registration_number" value={form.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} placeholder="e.g., U74999DL2020PTC123456" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst_number">GST Number</Label>
                <Input id="gst_number" value={form.gst_number} onChange={(e) => updateField("gst_number", e.target.value)} placeholder="e.g., 29AABCU9603R1ZM" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan_number">PAN Number</Label>
                <Input id="pan_number" value={form.pan_number} onChange={(e) => updateField("pan_number", e.target.value)} placeholder="e.g., AABCU9603R" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID / TAN</Label>
                <Input id="tax_id" value={form.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} placeholder="Tax identification number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="founded_date">Founded Date</Label>
                <Input id="founded_date" type="date" value={form.founded_date} onChange={(e) => updateField("founded_date", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number_of_employees">Number of Employees</Label>
                <Input id="number_of_employees" type="number" value={form.number_of_employees ?? ""} onChange={(e) => updateField("number_of_employees", e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g., 250" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="info@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Primary Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_phone">Secondary Phone</Label>
                <Input id="secondary_phone" value={form.secondary_phone} onChange={(e) => updateField("secondary_phone", e.target.value)} placeholder="+91 98765 43211" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fax">Fax</Label>
                <Input id="fax" value={form.fax} onChange={(e) => updateField("fax", e.target.value)} placeholder="Fax number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://www.company.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Registered Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input id="address_line1" value={form.address_line1} onChange={(e) => updateField("address_line1", e.target.value)} placeholder="Street address" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input id="address_line2" value={form.address_line2} onChange={(e) => updateField("address_line2", e.target.value)} placeholder="Apartment, suite, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state} onChange={(e) => updateField("state", e.target.value)} placeholder="State" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={form.country} onChange={(e) => updateField("country", e.target.value)} placeholder="Country" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input id="postal_code" value={form.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} placeholder="PIN Code" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Operational Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                  <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => updateField("timezone", v)}>
                  <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year Starts</Label>
                <Select value={form.fiscal_year_start} onValueChange={(v) => updateField("fiscal_year_start", v)}>
                  <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Media */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Social Media
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Linkedin className="h-4 w-4" /> LinkedIn</Label>
                <Input value={form.linkedin_url} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/..." />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook</Label>
                <Input value={form.facebook_url} onChange={(e) => updateField("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</Label>
                <Input value={form.instagram_url} onChange={(e) => updateField("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Twitter className="h-4 w-4" /> Twitter / X</Label>
                <Input value={form.twitter_url} onChange={(e) => updateField("twitter_url", e.target.value)} placeholder="https://x.com/..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Company Information
          </Button>
        </div>
      </form>
    </div>
  );
}
