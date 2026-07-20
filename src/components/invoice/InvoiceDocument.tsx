import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import type { InvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { amountInWords } from "@/lib/numberToWords";
import { format } from "date-fns";

export interface InvoiceLineItem {
  sl: number;
  description: string;
  sku?: string | null;
  hsn?: string | null;
  certificate_no?: string | null;
  gross_wt?: number | null;
  net_wt?: number | null;
  dia_wt?: number | null;
  stone_wt?: number | null;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceOrderInfo {
  invoice_number: string;
  invoice_date: string | Date;
  dispatch_date?: string | Date | null;
  terms?: string | null;
  reference?: string | null;
  subtotal: number;
  discount: number;
  total: number;
}

export interface InvoiceCustomerInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  state?: string | null;
  gst?: string | null;
}

interface Props {
  template: InvoiceTemplate;
  company: CompanyInfo | null;
  order: InvoiceOrderInfo;
  customer: InvoiceCustomerInfo;
  lineItems: InvoiceLineItem[];
}

function inr(n: number) {
  return (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return format(dt, "dd/MM/yyyy");
}

export function InvoiceDocument({ template, company, order, customer, lineItems }: Props) {
  const companyName =
    template.company_name_override?.trim() ||
    company?.company_name ||
    "Company Name";
  const tagline = template.tagline_override?.trim() || company?.tagline || "";
  const primary = template.color_primary || "#7A1E2B";
  const accent = template.color_accent || "#C9A961";
  const fontFamily =
    template.font_family === "sans"
      ? "ui-sans-serif, system-ui, -apple-system, sans-serif"
      : template.font_family === "mono"
      ? "ui-monospace, SFMono-Regular, monospace"
      : "Georgia, 'Times New Roman', serif";

  const totalGross = lineItems.reduce((s, li) => s + (li.gross_wt || 0), 0);
  const totalNet = lineItems.reduce((s, li) => s + (li.net_wt || 0), 0);
  const totalDia = lineItems.reduce((s, li) => s + (li.dia_wt || 0), 0);
  const totalStone = lineItems.reduce((s, li) => s + (li.stone_wt || 0), 0);
  const totalAmount = lineItems.reduce((s, li) => s + (li.amount || 0), 0);

  const taxableAfterDiscount = Math.max(0, order.subtotal - (order.discount || 0));
  const sgstAmt = (taxableAfterDiscount * (Number(template.sgst_rate) || 0)) / 100;
  const cgstAmt = (taxableAfterDiscount * (Number(template.cgst_rate) || 0)) / 100;
  const grandTotal = taxableAfterDiscount + sgstAmt + cgstAmt;

  return (
    <div
      className="invoice-print-root bg-white text-black text-[11px] leading-tight mx-auto"
      style={{ fontFamily, width: "210mm", minHeight: "297mm", padding: "8mm" }}
    >
      {/* Header band */}
      <div className="border" style={{ borderColor: primary }}>
        <div
          className="flex items-center justify-between px-3 py-2 text-white"
          style={{ backgroundColor: primary }}
        >
          <div className="text-[10px] font-semibold">
            {template.show_gst && company?.gst_number && <div>GST: {company.gst_number}</div>}
            {template.show_pan && company?.pan_number && <div>PAN: {company.pan_number}</div>}
          </div>
          <div className="flex flex-col items-center">
            {template.show_logo && company?.logo_url && (
              <img src={company.logo_url} alt="logo" className="h-12 object-contain" />
            )}
            <div className="text-lg font-bold tracking-wide" style={{ color: accent }}>
              {companyName}
            </div>
            {tagline && <div className="text-[10px] italic">— {tagline} —</div>}
          </div>
          <div className="text-[10px] font-semibold text-right">
            {template.show_cin && company?.registration_number && <div>CIN: {company.registration_number}</div>}
            {template.show_phone && company?.phone && <div>Ph: {company.phone}</div>}
          </div>
        </div>
        {template.show_address && company && (
          <div className="px-3 py-1 text-[10px] text-center border-t" style={{ borderColor: primary }}>
            {[company.address_line1, company.address_line2, company.city, company.state, company.postal_code]
              .filter(Boolean)
              .join(", ")}
          </div>
        )}
        <div
          className="text-center font-semibold py-1"
          style={{ backgroundColor: `${primary}15`, color: primary }}
        >
          {companyName.toUpperCase()}
        </div>
        <div
          className="text-center font-bold py-1 border-t"
          style={{ borderColor: primary }}
        >
          {template.invoice_title || "TAX INVOICE"}
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 border-t" style={{ borderColor: primary }}>
          <div className="border-r p-2" style={{ borderColor: primary }}>
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <div className="font-semibold">Invoice No.:</div>
              <div>{order.invoice_number}</div>
              <div className="font-semibold">Dispatch Through &amp; Date:</div>
              <div>{formatDate(order.dispatch_date || order.invoice_date)}</div>
            </div>
          </div>
          <div className="p-2">
            <div className="grid grid-cols-[110px_1fr] gap-y-1">
              <div className="font-semibold">Date:</div>
              <div>{formatDate(order.invoice_date)}</div>
              <div className="font-semibold">Terms &amp; Condition:</div>
              <div>{order.terms || ""}</div>
              <div className="font-semibold">Mode/Terms of Payment:</div>
              <div></div>
              <div className="font-semibold">Reference:</div>
              <div>{order.reference || ""}</div>
            </div>
          </div>
        </div>

        {/* Billed / Shipped */}
        <div className="grid grid-cols-2 border-t" style={{ borderColor: primary }}>
          <div className="border-r p-2" style={{ borderColor: primary }}>
            <div className="font-semibold underline mb-1">Details of Receiver | Billed To:</div>
            <div>{customer.name}</div>
            {customer.address && <div className="whitespace-pre-line">{customer.address}</div>}
            {customer.phone && <div>{customer.phone}</div>}
            {customer.gst && <div>GSTIN: {customer.gst}</div>}
          </div>
          <div className="p-2">
            <div className="font-semibold underline mb-1">Details of Consignor | Shipped To:</div>
            <div>{customer.name}</div>
            {customer.address && <div className="whitespace-pre-line">{customer.address}</div>}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border-t border-collapse" style={{ borderColor: primary }}>
          <thead style={{ backgroundColor: `${primary}10` }}>
            <tr className="text-[10px]">
              {["Sl.No.", "Description of Product", "HSN/SAC", "Certificate No.", "Gross Wt.", "Net Wt.", "Dia Wt.", "Stone Wt.", "Rate", "Amount"].map((h) => (
                <th
                  key={h}
                  className="border px-1 py-1 text-left font-semibold"
                  style={{ borderColor: primary }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => (
              <tr key={li.sl} className="align-top">
                <td className="border px-1 py-1" style={{ borderColor: primary }}>{li.sl}</td>
                <td className="border px-1 py-1" style={{ borderColor: primary }}>
                  <div className="font-semibold">{li.description}</div>
                  {li.sku && <div className="text-[10px]">{li.sku}</div>}
                </td>
                <td className="border px-1 py-1" style={{ borderColor: primary }}>{li.hsn || ""}</td>
                <td className="border px-1 py-1" style={{ borderColor: primary }}>{li.certificate_no || ""}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{li.gross_wt ? Number(li.gross_wt).toFixed(3) : ""}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{li.net_wt ? Number(li.net_wt).toFixed(3) : ""}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{li.dia_wt ? Number(li.dia_wt).toFixed(3) : ""}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{li.stone_wt ? Number(li.stone_wt).toFixed(3) : "0.000"}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{inr(li.rate)}</td>
                <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{inr(li.amount)}</td>
              </tr>
            ))}
            {/* filler */}
            {Array.from({ length: Math.max(0, 6 - lineItems.length) }).map((_, i) => (
              <tr key={`f-${i}`}>
                {Array.from({ length: 10 }).map((__, j) => (
                  <td key={j} className="border px-1 py-3" style={{ borderColor: primary }}>&nbsp;</td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold" style={{ backgroundColor: `${primary}08` }}>
              <td className="border px-1 py-1" style={{ borderColor: primary }}></td>
              <td className="border px-1 py-1" style={{ borderColor: primary }}>Total</td>
              <td className="border px-1 py-1" style={{ borderColor: primary }}></td>
              <td className="border px-1 py-1" style={{ borderColor: primary }}></td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{totalGross.toFixed(3)}</td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{totalNet.toFixed(3)}</td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{totalDia.toFixed(3)}</td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{totalStone.toFixed(3)}</td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{inr(totalAmount)}</td>
              <td className="border px-1 py-1 text-right" style={{ borderColor: primary }}>{inr(totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals block */}
        <div className="grid grid-cols-[1fr_260px] border-t" style={{ borderColor: primary }}>
          <div></div>
          <div>
            {order.discount > 0 && (
              <div className="flex justify-between px-2 py-1 border-b" style={{ borderColor: primary }}>
                <span>Discount</span><span>- {inr(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between px-2 py-1 border-b" style={{ borderColor: primary }}>
              <span>SGST {Number(template.sgst_rate).toFixed(1)}% @ {Number(template.sgst_rate).toFixed(1)}%</span>
              <span>{inr(sgstAmt)}</span>
            </div>
            <div className="flex justify-between px-2 py-1 border-b" style={{ borderColor: primary }}>
              <span>CGST {Number(template.cgst_rate).toFixed(1)}% @ {Number(template.cgst_rate).toFixed(1)}%</span>
              <span>{inr(cgstAmt)}</span>
            </div>
            <div className="flex justify-between px-2 py-2 font-bold" style={{ backgroundColor: `${primary}15` }}>
              <span>Grand Total</span>
              <span>{inr(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words + footer note */}
        <div className="border-t px-2 py-1" style={{ borderColor: primary }}>
          <span className="font-semibold">Amount In Words: </span>
          <span>{amountInWords(grandTotal)}</span>
        </div>
        {template.footer_note && (
          <div className="border-t px-2 py-1" style={{ borderColor: primary }}>
            {template.footer_note}
          </div>
        )}

        {/* Bank & signature */}
        <div className="grid grid-cols-2 border-t" style={{ borderColor: primary }}>
          <div className="border-r p-2" style={{ borderColor: primary }}>
            {template.show_bank_details && (
              <>
                <div className="font-semibold mb-1">Our Bank Details:</div>
                {template.bank_account_no && <div>A/c No.: {template.bank_account_no}</div>}
                {template.bank_name && <div>Banker: {template.bank_name}</div>}
                {template.bank_branch && <div>Branch: {template.bank_branch}</div>}
                {template.bank_rtgs_ifsc && <div>RTGS: {template.bank_rtgs_ifsc}</div>}
              </>
            )}
            {template.terms_and_conditions && (
              <div className="mt-2 whitespace-pre-line text-[10px]">
                {template.terms_and_conditions}
              </div>
            )}
          </div>
          <div className="p-2 flex flex-col justify-between items-end">
            <div className="text-right font-semibold">For {companyName.toUpperCase()}</div>
            <div className="flex flex-col items-center gap-1">
              {template.seal_url && <img src={template.seal_url} alt="seal" className="h-14 object-contain" />}
              {template.signature_url && <img src={template.signature_url} alt="signature" className="h-10 object-contain" />}
              <div className="border-t pt-1 min-w-[160px] text-center" style={{ borderColor: primary }}>
                {template.authorised_signatory_label || "Authorised Signatory"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}