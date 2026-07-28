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
  returnId: string;
}

export function ExchangeReceiptDialog({ open, onOpenChange, returnId }: Props) {
  const { data: company } = useCompanyInfo();

  const { data, isLoading } = useQuery({
    queryKey: ["exchange-receipt", returnId],
    enabled: open && !!returnId,
    queryFn: async () => {
      const { data: ret, error } = await supabase.from("returns").select("*").eq("id", returnId).single();
      if (error) throw error;
      const r: any = ret;

      const { data: retItems } = await supabase.from("return_items").select("*").eq("return_id", returnId);

      const orderIds = [r.order_id, r.exchange_order_id].filter(Boolean);
      const { data: orders } = orderIds.length
        ? await supabase.from("orders").select("id, order_number, invoice_number, created_at, total_amount").in("id", orderIds)
        : { data: [] as any[] };
      const oById = new Map((orders || []).map((o: any) => [o.id, o]));

      let newItems: any[] = [];
      if (r.exchange_order_id) {
        const { data: oi } = await supabase
          .from("order_items")
          .select("id, quantity, unit_price, total_amount, item_id")
          .eq("order_id", r.exchange_order_id);
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
      if (r.customer_id) {
        const { data: c } = await supabase.from("customers").select("name, phone").eq("id", r.customer_id).maybeSingle();
        customer = c;
      }

      return {
        ret: r,
        retItems: retItems || [],
        originalOrder: oById.get(r.order_id) || null,
        exchangeOrder: oById.get(r.exchange_order_id) || null,
        newItems,
        customer,
      };
    },
  });

  const ret: any = data?.ret;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] max-h-[92vh] overflow-y-auto invoice-viewer-dialog">
        <DialogHeader className="no-print">
          <DialogTitle>Exchange Receipt</DialogTitle>
        </DialogHeader>

        {isLoading || !ret ? (
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
              <div className="text-sm font-bold uppercase tracking-wide">
                {company?.company_name || "Company"}
              </div>
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
            <div className="text-center text-xs font-bold uppercase">Exchange Receipt</div>
            <div className="my-2 border-t border-dashed border-black" />

            {/* Meta */}
            <div className="space-y-0.5">
              <Row label="Return #" value={ret.return_number} />
              <Row label="Date" value={format(new Date(ret.created_at), "dd/MM/yyyy HH:mm")} />
              <Row label="Customer" value={data?.customer?.name || "Walk-in"} />
              {data?.customer?.phone && <Row label="Phone" value={data.customer.phone} />}
              <Row
                label="Orig. Invoice"
                value={data?.originalOrder?.invoice_number || data?.originalOrder?.order_number || "—"}
              />
              <Row label="Orig. Order #" value={data?.originalOrder?.order_number || "—"} />
              <Row
                label="New Invoice"
                value={data?.exchangeOrder?.invoice_number || "—"}
              />
              <Row label="New Order #" value={data?.exchangeOrder?.order_number || "—"} />
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Returned goods */}
            <div className="font-bold mb-1">Goods Exchanged (Returned)</div>
            {(data?.retItems || []).length === 0 ? (
              <div className="text-[10px]">—</div>
            ) : (
              <div className="space-y-1">
                {data!.retItems.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex justify-between">
                      <span className="flex-1 pr-2">{it.product_name || it.sku || "Item"}</span>
                      <span>{inr(Number(it.original_selling_price ?? it.unit_price))}</span>
                    </div>
                    <div className="text-[10px] text-gray-600 pl-2">
                      {[it.sku && `LL: ${it.sku}`, it.purity, it.net_wt && `Net ${it.net_wt}g`, it.gross_wt && `Gr ${it.gross_wt}g`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="my-2 border-t border-dashed border-black" />

            {/* New purchase */}
            <div className="font-bold mb-1">Purchased Against Exchange</div>
            {(data?.newItems || []).length === 0 ? (
              <div className="text-[10px]">—</div>
            ) : (
              <div className="space-y-1">
                {data!.newItems.map((it: any) => (
                  <div key={it.id}>
                    <div className="flex justify-between">
                      <span className="flex-1 pr-2">{it.inv?.name || "Item"}</span>
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
              <Row label="Return Value" value={inr(Number(ret.return_value))} />
              <Row label="New Purchase Value" value={inr(Number(ret.new_purchase_value))} />
              <div className="flex justify-between font-bold text-xs border-t border-dashed border-black pt-1">
                <span>Additional Paid</span>
                <span>{inr(Number(ret.additional_amount))}</span>
              </div>
              {ret.refund_method && <Row label="Mode" value={String(ret.refund_method).toUpperCase()} />}
            </div>

            <div className="text-center text-[10px] mt-4">
              <div>Exchange only — no cash refund.</div>
              <div className="mt-1">Thank you for shopping with us!</div>
            </div>
          </div>
        )}

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
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