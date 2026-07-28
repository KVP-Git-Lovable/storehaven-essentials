import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { format } from "date-fns";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exchangeId: string;
}

export function OldGoldReceiptDialog({ open, onOpenChange, exchangeId }: Props) {
  const { data: company } = useCompanyInfo();

  const { data, isLoading } = useQuery({
    queryKey: ["old-gold-receipt", exchangeId],
    enabled: open && !!exchangeId,
    queryFn: async () => {
      const { data: ex, error } = await (supabase as any)
        .from("old_gold_exchanges")
        .select("*")
        .eq("id", exchangeId)
        .single();
      if (error) throw error;
      const e: any = ex;

      const { data: oldItems } = await (supabase as any)
        .from("old_gold_exchange_items")
        .select("*")
        .eq("exchange_id", exchangeId)
        .order("created_at");

      let order: any = null;
      let newItems: any[] = [];
      if (e.order_id) {
        const { data: o } = await supabase
          .from("orders")
          .select("id, order_number, invoice_number, created_at, total_amount")
          .eq("id", e.order_id)
          .maybeSingle();
        order = o;
        const { data: oi } = await supabase
          .from("order_items")
          .select("id, quantity, unit_price, total_amount, item_id")
          .eq("order_id", e.order_id);
        newItems = oi || [];
        const ids = newItems.map((i: any) => i.item_id).filter(Boolean);
        if (ids.length) {
          const { data: inv } = await (supabase as any)
            .from("inventory_items")
            .select("id, name, sku")
            .in("id", ids);
          const invById = new Map((inv || []).map((x: any) => [x.id, x]));
          newItems = newItems.map((i: any) => ({ ...i, inv: invById.get(i.item_id) }));
        }
      }

      let customer: any = null;
      if (e.customer_id) {
        const { data: c } = await supabase.from("customers").select("name, phone").eq("id", e.customer_id).maybeSingle();
        customer = c;
      }

      let operator: string | null = null;
      if (e.processed_by) {
        const { data: p } = await supabase.from("profiles").select("username").eq("id", e.processed_by).maybeSingle();
        operator = (p as any)?.username || null;
      }

      return { ex: e, oldItems: oldItems || [], order, newItems, customer, operator };
    },
  });

  const ex: any = data?.ex;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] max-h-[92vh] overflow-y-auto invoice-viewer-dialog">
        <DialogHeader className="no-print">
          <DialogTitle>Old Gold Exchange Receipt</DialogTitle>
        </DialogHeader>

        {isLoading || !ex ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="invoice-print-root mx-auto w-[320px] bg-white text-black p-4 text-[11px] leading-tight border">
            {/* Header */}
            <div className="text-center space-y-1">
              {company?.logo_url && (
                <img
                  src={company.logo_url}
                  alt={`${company?.company_name || "Company"} logo`}
                  className="mx-auto h-12 w-auto object-contain"
                />
              )}
              <div className="text-sm font-bold uppercase tracking-wide">{company?.company_name || "Company"}</div>
              {company?.tagline && <div className="text-[10px]">{company.tagline}</div>}
              {[company?.address_line1, company?.address_line2, company?.city, company?.state, company?.postal_code]
                .filter(Boolean).length > 0 && (
                <div className="text-[10px]">
                  {[company?.address_line1, company?.address_line2, company?.city, company?.state, company?.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              {company?.phone && <div className="text-[10px]">Tel: {company.phone}</div>}
              {company?.gst_number && <div className="text-[10px]">GSTIN: {company.gst_number}</div>}
            </div>

            <div className="my-2 border-t border-dashed border-black" />
            <div className="text-center text-xs font-bold uppercase">Old Gold Exchange Receipt</div>
            <div className="my-2 border-t border-dashed border-black" />

            {/* Meta */}
            <div className="space-y-0.5">
              <Row label="Receipt #" value={ex.exchange_number} />
              <Row label="Date" value={format(new Date(ex.exchange_date || ex.created_at), "dd/MM/yyyy HH:mm")} />
              <Row label="Customer" value={data?.customer?.name || "Walk-in"} />
              {data?.customer?.phone && <Row label="Phone" value={data.customer.phone} />}
              <Row label="Operator" value={data?.operator || "—"} />
              <Row label="Invoice" value={data?.order?.invoice_number || "—"} />
              <Row label="Order #" value={data?.order?.order_number || "—"} />
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Old gold received */}
            <div className="font-bold mb-1">Old Gold Received</div>
            {(data?.oldItems || []).length === 0 ? (
              <div className="text-[10px]">—</div>
            ) : (
              <div className="space-y-1">
                {data!.oldItems.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex justify-between">
                      <span className="flex-1 pr-2">{it.description || "Old gold"}</span>
                      <span>{inr(Number(it.calculated_value))}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 pl-2">
                      {[
                        it.ornament_type,
                        it.karat,
                        `Gr ${Number(it.gross_wt).toFixed(3)}g`,
                        `Purity ${Number(it.measured_purity)}%`,
                        `Fine ${Number(it.fine_gold_wt).toFixed(3)}g`,
                        `@ ₹${Number(it.purchase_rate).toLocaleString("en-IN")}/g`,
                        Number(it.deductions) > 0 ? `Less ₹${Number(it.deductions).toLocaleString("en-IN")}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {it.remarks && <div className="text-[10px] text-gray-600 pl-2">{it.remarks}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="my-2 border-t border-dashed border-black" />

            {/* New purchase */}
            <div className="font-bold mb-1">New Jewellery Purchased</div>
            {(data?.newItems || []).length === 0 ? (
              <div className="text-[10px]">—</div>
            ) : (
              <div className="space-y-1">
                {data!.newItems.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex justify-between">
                      <span className="flex-1 pr-2">
                        {it.inv?.name || "Item"} × {Number(it.quantity) || 1}
                      </span>
                      <span>{inr(Number(it.total_amount) || Number(it.unit_price))}</span>
                    </div>
                    {it.inv?.sku && <div className="text-[10px] text-gray-600 pl-2">LL: {it.inv.sku}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="my-2 border-t border-dashed border-black" />

            {/* Totals */}
            <div className="space-y-0.5">
              <Row label="Total Old Gold Value" value={inr(Number(ex.total_old_gold_value))} />
              <Row label="New Purchase Value" value={inr(Number(ex.total_purchase_value))} />
              <div className="flex justify-between font-bold text-xs border-t border-dashed border-black pt-1">
                <span>Additional Paid</span>
                <span>{inr(Number(ex.additional_amount))}</span>
              </div>
              {ex.payment_method && <Row label="Mode" value={String(ex.payment_method).toUpperCase()} />}
            </div>

            <div className="text-center text-[10px] mt-4">
              <div>Exchange only — no cash refund, wallet balance or store credit.</div>
              <div className="mt-1">Thank you for shopping with us!</div>
            </div>
          </div>
        )}

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()} disabled={isLoading}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-700">{label}:</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
