import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { InvoiceDocument, type InvoiceLineItem } from "./InvoiceDocument";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
}

export function InvoiceViewerDialog({ open, onOpenChange, orderId }: Props) {
  const qc = useQueryClient();
  const { data: template, isLoading: tplLoading } = useInvoiceTemplate();
  const { data: company } = useCompanyInfo();
  const [allocating, setAllocating] = useState(false);

  const { data: bundle, isLoading, refetch } = useQuery({
    queryKey: ["invoice-order-bundle", orderId],
    enabled: open && !!orderId,
    queryFn: async () => {
      const { data: order, error: e1 } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (e1) throw e1;

      const { data: items, error: e2 } = await supabase
        .from("order_items")
        .select("id, quantity, unit_price, total_amount, item_id")
        .eq("order_id", orderId);
      if (e2) throw e2;

      const itemIds = (items || []).map((i: any) => i.item_id).filter(Boolean);
      let inventoryMap: Record<string, any> = {};
      if (itemIds.length) {
        const { data: inv } = await (supabase as any)
          .from("inventory_items")
          .select("id, name, sku, main_metal, category, net_wt, gross_wt, total_diamond_wt, total_colour_stone_wt, product_cert_no")
          .in("id", itemIds);
        (inv || []).forEach((r: any) => { inventoryMap[r.id] = r; });
      }

      let customer: any = null;
      if ((order as any).customer_id) {
        const { data: c } = await supabase
          .from("customers")
          .select("*")
          .eq("id", (order as any).customer_id)
          .maybeSingle();
        customer = c;
      }

      return { order, items: items || [], inventoryMap, customer };
    },
  });

  // Allocate invoice number if missing
  useEffect(() => {
    if (!open || !bundle || allocating) return;
    const order = bundle.order as any;
    if (!order || order.invoice_number) return;
    (async () => {
      setAllocating(true);
      try {
        const { data: num, error } = await (supabase as any).rpc("allocate_invoice_number");
        if (error) throw error;
        const { error: upErr } = await supabase
          .from("orders")
          .update({ invoice_number: num, invoice_generated_at: new Date().toISOString() } as any)
          .eq("id", orderId);
        if (upErr) throw upErr;
        await qc.invalidateQueries({ queryKey: ["invoice-template"] });
        await refetch();
      } catch (err: any) {
        toast.error("Failed to allocate invoice number: " + err.message);
      } finally {
        setAllocating(false);
      }
    })();
  }, [open, bundle, allocating, orderId, qc, refetch]);

  const handlePrint = () => {
    window.print();
  };

  const loading = isLoading || tplLoading || allocating;
  const order: any = bundle?.order;
  const items = bundle?.items || [];
  const invMap = bundle?.inventoryMap || {};
  const customer = bundle?.customer;

  const lineItems: InvoiceLineItem[] = items.map((it: any, idx: number) => {
    const inv = invMap[it.item_id] || {};
    const qty = Number(it.quantity) || 1;
    const rate = Number(it.unit_price) || 0;
    const amount = Number(it.total_amount) || rate * qty;
    const metal = inv.main_metal ? String(inv.main_metal).trim() : "";
    const category = inv.category ? String(inv.category).trim() : "";
    const description = [metal, category].filter(Boolean).join(" ") || inv.name || "Item";
    return {
      sl: idx + 1,
      description,
      sku: inv.sku,
      hsn: template?.default_hsn_code || null,
      certificate_no: inv.product_cert_no,
      gross_wt: inv.gross_wt,
      net_wt: inv.net_wt,
      dia_wt: inv.total_diamond_wt,
      stone_wt: inv.total_colour_stone_wt,
      quantity: qty,
      rate,
      amount,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[92vh] overflow-y-auto invoice-viewer-dialog">
        <DialogHeader>
          <DialogTitle>Invoice{order?.invoice_number ? ` — ${order.invoice_number}` : ""}</DialogTitle>
        </DialogHeader>
        {loading || !template || !order ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-muted/40 p-4">
            <InvoiceDocument
              template={template}
              company={company || null}
              order={{
                invoice_number: order.invoice_number || "—",
                invoice_date: order.invoice_generated_at || order.created_at,
                dispatch_date: order.created_at,
                terms: null,
                reference: order.order_number,
                subtotal: Number(order.subtotal) || 0,
                discount: Number(order.discount_amount) || 0,
                total: Number(order.total_amount) || 0,
              }}
              customer={{
                name: customer?.name || "Walk-in Customer",
                address: [customer?.address_line1, customer?.address_line2, customer?.city, customer?.state, customer?.postal_code]
                  .filter(Boolean)
                  .join(", ") || null,
                phone: customer?.phone,
                state: customer?.state,
                gst: customer?.gst_number,
              }}
              lineItems={lineItems}
            />
          </div>
        )}
        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} disabled={loading}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}