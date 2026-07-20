import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useInvoiceTemplate, type InvoiceTemplate as InvoiceTemplateType } from "@/hooks/useInvoiceTemplate";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";

const defaultForm: Partial<InvoiceTemplateType> = {
  invoice_title: "TAX INVOICE",
  company_name_override: "",
  tagline_override: "",
  show_logo: true,
  show_gst: true,
  show_pan: true,
  show_cin: true,
  show_phone: true,
  show_address: true,
  show_bank_details: true,
  invoice_prefix: "TJ-26/27-",
  next_invoice_number: 1,
  invoice_number_padding: 4,
  bank_name: "",
  bank_account_no: "",
  bank_branch: "",
  bank_rtgs_ifsc: "",
  sgst_rate: 1.5,
  cgst_rate: 1.5,
  igst_rate: 3.0,
  default_hsn_code: "71131930",
  color_primary: "#7A1E2B",
  color_accent: "#C9A961",
  font_family: "serif",
  terms_and_conditions: "",
  footer_note: "",
  authorised_signatory_label: "Authorised Signatory",
  signature_url: "",
  seal_url: "",
};

export default function InvoiceTemplatePage() {
  const qc = useQueryClient();
  const { data: template, isLoading } = useInvoiceTemplate();
  const { data: company } = useCompanyInfo();
  const [form, setForm] = useState<any>(defaultForm);
  const [uploading, setUploading] = useState<"signature" | "seal" | null>(null);

  useEffect(() => {
    if (template) setForm(template);
  }, [template]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        sgst_rate: Number(form.sgst_rate) || 0,
        cgst_rate: Number(form.cgst_rate) || 0,
        igst_rate: Number(form.igst_rate) || 0,
        next_invoice_number: Number(form.next_invoice_number) || 1,
        invoice_number_padding: Number(form.invoice_number_padding) || 4,
      };
      delete payload.created_at;
      delete payload.updated_at;
      if (template?.id) {
        const { error } = await (supabase as any).from("invoice_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("invoice_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Invoice template saved");
      qc.invalidateQueries({ queryKey: ["invoice-template"] });
    },
    onError: (e: any) => toast.error("Failed to save: " + e.message),
  });

  const update = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));

  const handleUpload = async (kind: "signature" | "seal", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop();
      const fname = `invoice-${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("company-assets").upload(fname, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("company-assets").getPublicUrl(fname);
      update(kind === "signature" ? "signature_url" : "seal_url", publicUrl);
      toast.success("Uploaded");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const preview: InvoiceTemplateType = { ...(defaultForm as any), ...form, id: template?.id || "preview" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Template</h1>
          <p className="text-muted-foreground">Design the tax invoice used when generating an invoice for an order</p>
        </div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Template
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Company Name Override (blank = use Company Information)</Label>
                <Input value={form.company_name_override || ""} onChange={(e) => update("company_name_override", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Tagline Override</Label>
                <Input value={form.tagline_override || ""} onChange={(e) => update("tagline_override", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Primary Color</Label>
                <Input type="color" value={form.color_primary || "#7A1E2B"} onChange={(e) => update("color_primary", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Accent Color</Label>
                <Input type="color" value={form.color_accent || "#C9A961"} onChange={(e) => update("color_accent", e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Font Family</Label>
                <Select value={form.font_family || "serif"} onValueChange={(v) => update("font_family", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serif">Serif (Times / Georgia)</SelectItem>
                    <SelectItem value="sans">Sans-serif</SelectItem>
                    <SelectItem value="mono">Monospace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Header Fields</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Invoice Title</Label>
                <Input value={form.invoice_title || ""} onChange={(e) => update("invoice_title", e.target.value)} />
              </div>
              {[
                ["show_logo", "Show Logo"],
                ["show_gst", "Show GST"],
                ["show_pan", "Show PAN"],
                ["show_cin", "Show CIN"],
                ["show_phone", "Show Phone"],
                ["show_address", "Show Address"],
                ["show_bank_details", "Show Bank Details"],
              ].map(([k, l]) => (
                <div key={k} className="flex items-center justify-between rounded border px-3 py-2">
                  <Label htmlFor={k}>{l}</Label>
                  <Switch id={k} checked={!!form[k]} onCheckedChange={(v) => update(k as string, v)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Invoice Numbering</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Prefix</Label>
                <Input value={form.invoice_prefix || ""} onChange={(e) => update("invoice_prefix", e.target.value)} placeholder="TJ-26/27-" />
              </div>
              <div className="space-y-1">
                <Label>Padding</Label>
                <Input type="number" min={1} value={form.invoice_number_padding || 4} onChange={(e) => update("invoice_number_padding", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Next Number</Label>
                <Input type="number" min={1} value={form.next_invoice_number || 1} onChange={(e) => update("next_invoice_number", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Preview</Label>
                <Input disabled value={`${form.invoice_prefix || ""}${String(form.next_invoice_number || 1).padStart(Number(form.invoice_number_padding) || 4, "0")}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tax</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>SGST %</Label>
                <Input type="number" step="0.01" value={form.sgst_rate ?? 0} onChange={(e) => update("sgst_rate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CGST %</Label>
                <Input type="number" step="0.01" value={form.cgst_rate ?? 0} onChange={(e) => update("cgst_rate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>IGST %</Label>
                <Input type="number" step="0.01" value={form.igst_rate ?? 0} onChange={(e) => update("igst_rate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Default HSN Code</Label>
                <Input value={form.default_hsn_code || ""} onChange={(e) => update("default_hsn_code", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Bank Name</Label><Input value={form.bank_name || ""} onChange={(e) => update("bank_name", e.target.value)} /></div>
              <div className="space-y-1"><Label>Account No.</Label><Input value={form.bank_account_no || ""} onChange={(e) => update("bank_account_no", e.target.value)} /></div>
              <div className="space-y-1"><Label>Branch</Label><Input value={form.bank_branch || ""} onChange={(e) => update("bank_branch", e.target.value)} /></div>
              <div className="space-y-1"><Label>RTGS / IFSC</Label><Input value={form.bank_rtgs_ifsc || ""} onChange={(e) => update("bank_rtgs_ifsc", e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Signature & Seal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Signature</Label>
                {form.signature_url && <img src={form.signature_url} alt="signature" className="h-16 object-contain border rounded p-1" />}
                <label className="inline-flex">
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading === "signature"}>
                    <span className="cursor-pointer">
                      {uploading === "signature" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload("signature", e)} />
                </label>
              </div>
              <div className="space-y-2">
                <Label>Seal</Label>
                {form.seal_url && <img src={form.seal_url} alt="seal" className="h-16 object-contain border rounded p-1" />}
                <label className="inline-flex">
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading === "seal"}>
                    <span className="cursor-pointer">
                      {uploading === "seal" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload("seal", e)} />
                </label>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Signatory Label</Label>
                <Input value={form.authorised_signatory_label || ""} onChange={(e) => update("authorised_signatory_label", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Terms & Footer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Terms & Conditions</Label>
                <Textarea rows={3} value={form.terms_and_conditions || ""} onChange={(e) => update("terms_and_conditions", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Footer Note</Label>
                <Textarea rows={2} value={form.footer_note || ""} onChange={(e) => update("footer_note", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-2 sticky top-4 self-start">
          <div className="text-sm font-semibold text-muted-foreground">Live Preview</div>
          <div className="border rounded bg-muted/40 p-3 overflow-auto max-h-[85vh]">
            <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "210mm" }}>
              <InvoiceDocument
                template={preview}
                company={company || null}
                order={{
                  invoice_number: `${form.invoice_prefix || ""}${String(form.next_invoice_number || 1).padStart(Number(form.invoice_number_padding) || 4, "0")}`,
                  invoice_date: new Date(),
                  dispatch_date: new Date(),
                  reference: "ORD-PREVIEW",
                  subtotal: 221359.22,
                  discount: 0,
                  total: 228000,
                }}
                customer={{
                  name: "Sample Customer",
                  address: "Sample Address, City, State, 000000",
                  phone: "9999999999",
                  gst: null,
                }}
                lineItems={[
                  {
                    sl: 1,
                    description: "18KT Studded Gold & Diamond Jewellery",
                    sku: "LL-00001",
                    hsn: form.default_hsn_code || "71131930",
                    certificate_no: "SAMPLE001",
                    gross_wt: 3.87, net_wt: 3.213, dia_wt: 3.283, stone_wt: 0,
                    quantity: 1,
                    rate: 221359.22,
                    amount: 221359.22,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}