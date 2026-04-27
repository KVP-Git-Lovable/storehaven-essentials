import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { LeadRow } from "./LeadFormDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: LeadRow | null;
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export function LeadConvertDialog({ open, onOpenChange, lead }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("completed");
  const [lineItems, setLineItems] = useState([{ productId: "", quantity: "1" }]);
  const [linkExisting, setLinkExisting] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["lead-convert-products"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, price").order("name").limit(500);
      return data || [];
    },
  });

  // Duplicate detection — by phone or email (case-insensitive)
  const { data: duplicate, isFetching: dupLoading } = useQuery({
    queryKey: ["lead-convert-duplicate", lead?.id, lead?.phone, lead?.email],
    enabled: open && !!lead,
    queryFn: async () => {
      if (!lead) return null;
      const conditions: string[] = [];
      if (lead.phone) conditions.push(`phone.eq.${lead.phone}`);
      if (lead.email) conditions.push(`email.ilike.${lead.email}`);
      if (conditions.length === 0) return null;
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, email")
        .or(conditions.join(","))
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) {
      setStatus("completed");
      setLineItems([{ productId: "", quantity: "1" }]);
      setLinkExisting(false);
    }
  }, [open]);

  const enriched = useMemo(
    () =>
      lineItems.map((it, i) => {
        const p = products.find((x: any) => x.id === it.productId);
        const qty = Math.max(1, Number(it.quantity) || 1);
        const price = Number(p?.price) || 0;
        return { key: `${i}-${it.productId}`, index: i, qty, price, line: qty * price };
      }),
    [lineItems, products]
  );
  const subtotal = enriched.reduce((s, x) => s + x.line, 0);

  const convertMut = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead");
      const validItems = lineItems
        .map((it) => {
          const p = products.find((x: any) => x.id === it.productId);
          const qty = Math.max(1, Number(it.quantity) || 1);
          const price = Number(p?.price) || 0;
          return { productId: it.productId, qty, price, line: qty * price };
        })
        .filter((x) => x.productId && x.price > 0);

      if (validItems.length === 0) throw new Error("Add at least one product");

      // Resolve customer id — link existing or create new
      let customerId: string;
      if (duplicate && linkExisting) {
        customerId = duplicate.id;
      } else if (duplicate && !linkExisting) {
        throw new Error("Customer already exists. Choose 'Link existing customer' to proceed.");
      } else {
        const { data: created, error } = await supabase
          .from("customers")
          .insert({
            name: lead.name || null,
            phone: lead.phone,
            email: lead.email || null,
            tier: "bronze",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        customerId = created.id;
      }

      // Create order
      const { data: { user } } = await supabase.auth.getUser();
      const total = subtotal;
      const paymentStatus = status === "completed" ? "paid" : status === "cancelled" ? "cancelled" : "pending";
      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const { data: createdOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          status,
          payment_status: paymentStatus,
          payment_method: "cash",
          subtotal,
          tax_amount: 0,
          total_amount: total,
          created_by: user?.id || "lead-conversion",
        } as any)
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const { error: itemErr } = await supabase.from("order_items").insert(
        validItems.map((it) => ({
          order_id: createdOrder.id,
          item_id: it.productId,
          quantity: it.qty,
          unit_price: it.price,
          total_amount: it.line,
          tax_amount: 0,
        })) as any
      );
      if (itemErr) throw itemErr;

      // Mark lead converted
      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          is_converted: true,
          converted_at: new Date().toISOString(),
          converted_customer_id: customerId,
        })
        .eq("id", lead.id);
      if (leadErr) throw leadErr;
    },
    onSuccess: () => {
      toast.success("Lead converted to customer");
      qc.invalidateQueries({ queryKey: ["transactions-leads"] });
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = (i: number, patch: Partial<{ productId: string; quantity: string }>) =>
    setLineItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setLineItems((cur) => [...cur, { productId: "", quantity: "1" }]);
  const removeItem = (i: number) =>
    setLineItems((cur) => (cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i)));

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Lead to Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer info preview */}
          <Card className="p-4 bg-muted/30">
            <div className="text-sm font-semibold mb-2">Customer Details (from Lead)</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {lead.name || "—"}</div>
              <div><span className="text-muted-foreground">Phone:</span> {lead.phone}</div>
              <div><span className="text-muted-foreground">Email:</span> {lead.email || "—"}</div>
              <div><span className="text-muted-foreground">City:</span> {lead.city || "—"}</div>
            </div>
          </Card>

          {/* Duplicate notice */}
          {dupLoading && <p className="text-sm text-muted-foreground">Checking for duplicates...</p>}
          {duplicate && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div>
                  <strong>Customer already exists:</strong> {duplicate.name || "—"} ({duplicate.phone})
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="link-existing"
                    type="checkbox"
                    checked={linkExisting}
                    onChange={(e) => setLinkExisting(e.target.checked)}
                  />
                  <label htmlFor="link-existing" className="text-sm">Link to existing customer and proceed</label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          <div className="text-sm font-semibold">Order Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {lineItems.map((it, i) => {
              const e = enriched[i];
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-7">
                    <Label className="text-xs">Product</Label>
                    <SearchableSelect
                      value={it.productId}
                      onValueChange={(v) => updateItem(i, { productId: v })}
                      options={products.map((p: any) => ({ value: p.id, label: `${p.name} — ${inr(Number(p.price) || 0)}` }))}
                      placeholder="Select product..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(ev) => updateItem(i, { quantity: ev.target.value })}
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <Label className="text-xs">Total</Label>
                    <div className="h-10 flex items-center justify-end font-medium">{inr(e?.line || 0)}</div>
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={lineItems.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="flex justify-end text-sm">
            <div className="space-y-1 w-64">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{inr(subtotal)}</span></div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => convertMut.mutate()}
            disabled={convertMut.isPending || (!!duplicate && !linkExisting)}
          >
            {convertMut.isPending ? "Converting..." : "Convert & Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
