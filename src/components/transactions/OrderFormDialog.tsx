import { useEffect, useMemo, useState, lazy, Suspense } from "react";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { assertStockAvailable, recordSaleLedger } from "@/lib/inventoryStock";
import { InvoiceViewerDialog } from "@/components/invoice/InvoiceViewerDialog";
import { ManualPriceOverrideDialog, type ManualPriceRow } from "@/components/transactions/ManualPriceOverrideDialog";
import { OrderLineItemsSection } from "@/components/transactions/OrderLineItemsSection";
import { useOrderPricing, useOrderLineItems, emptyLine } from "@/hooks/useOrderPricing";
const CustomerFormDialog = lazy(() =>
  import("@/components/transactions/CustomerFormDialog").then((m) => ({ default: m.CustomerFormDialog }))
);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order?: {
    id: string;
    customer_id: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    order_number: string;
    subtotal: number;
    tax_amount: number | null;
    total_amount: number;
  } | null;
  mode?: "create" | "edit" | "view";
}

export function OrderFormDialog({ open, onOpenChange, order = null, mode = "create" }: Props) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [status, setStatus] = useState("completed");
  const [diaDiscount, setDiaDiscount] = useState("0");
  const [diaDiscountPct, setDiaDiscountPct] = useState("");
  const [makingDiscount, setMakingDiscount] = useState("0");
  const [makingDiscountPct, setMakingDiscountPct] = useState("");
  const [manualPriceOpen, setManualPriceOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const pricing = useOrderPricing(open);
  const { products, stockMap, goldRates, resolveSlab, unitPriceOf } = pricing;

  const {
    lineItems,
    setLineItems,
    updateLineItem,
    addLineItem,
    removeLineItem,
    enrichedItems,
    subtotal,
    diaPctNum,
    makingPctNum,
    diaDiscAmt: diaDiscAmtDisplay,
    makingDiscAmt: makingDiscAmtDisplay,
    discountAmount,
    sgstAmt,
    sgstRate,
    cgstAmt,
    cgstRate,
    igstAmt,
    igstRate,
    cessAmt,
    cessRate,
    total,
  } = useOrderLineItems(pricing, { diaDiscount, diaDiscountPct, makingDiscount, makingDiscountPct });

  const { data: customers = [] } = useQuery({
    queryKey: ["order-form-customers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").order("name").limit(1000);
      return data || [];
    },
  });

  const { data: existingOrderItems = [] } = useQuery({
    queryKey: ["order-form-items", order?.id],
    enabled: open && !!order?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("item_id, quantity, unit_price, dia_price, cs_price, making_charges")
        .eq("order_id", order!.id);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!order) {
      setCustomerId("");
      setStatus("completed");
      setLineItems([emptyLine()]);
      setDiaDiscount("0");
      setDiaDiscountPct("");
      setMakingDiscount("0");
      setMakingDiscountPct("");
      return;
    }
    setCustomerId(order.customer_id || "");
    setStatus(order.status || "completed");
    // Legacy orders stored a single combined discount; load it into Making by
    // default so totals stay the same. User can re-split as needed.
    setDiaDiscount("0");
    setDiaDiscountPct("");
    setMakingDiscount(String((order as any).discount_amount ?? 0));
    setMakingDiscountPct("");
  }, [open, order]);

  useEffect(() => {
    if (!open || !order?.id) return;
    if (existingOrderItems.length) {
      setLineItems(
        existingOrderItems.map((item: any) => {
          const product = products.find((p: any) => p.id === item.item_id);
          const base = product ? unitPriceOf(product).price : 0;
          const storedUnit = Number(item.unit_price) || 0;
          let dia = Number(item.dia_price) || 0;
          let cs = Number(item.cs_price) || 0;
          let making = Number(item.making_charges) || 0;
          // Backfill: if components are all zero but stored unit_price exceeds
          // today's base, treat the residual as making charges so the view
          // matches what was originally entered (and what the invoice shows).
          if (dia === 0 && cs === 0 && making === 0 && storedUnit > base + 0.5) {
            making = Math.round((storedUnit - base) * 100) / 100;
          }
          return {
            productId: item.item_id,
            quantity: String(item.quantity || 1),
            diaPrice: String(dia),
            csPrice: String(cs),
            makingCharges: String(making),
          };
        })
      );
    }
  }, [open, order?.id, existingOrderItems, products, goldRates]);

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const validItems = lineItems
        .map((item) => {
          const product = products.find((p: any) => p.id === item.productId);
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const hasOverride = !!item.unitPriceOverride;
          const base = hasOverride ? Number(item.unitPriceOverride) || 0 : unitPriceOf(product).price;
          const dia = Number(item.diaPrice) || 0;
          const cs = Number(item.csPrice) || 0;
          const making = Number(item.makingCharges) || 0;
          const unitPrice = base + dia + cs + making;
          return {
            productId: item.productId,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice,
            name: product?.name as string | undefined,
            diaPrice: dia,
            csPrice: cs,
            makingCharges: making,
          };
        })
        .filter((item) => item.productId && item.unitPrice > 0);

      if (!customerId) throw new Error("Customer is required");
      if (validItems.length === 0) throw new Error("Add at least one product");

      if (!isEdit) {
        const missingRate = Object.values(goldRates).some((v) => !(Number(v) > 0));
        if (missingRate) {
          throw new Error("Please set today's gold rates in Price Configuration under Inventory menu");
        }
      }

      // Stock guard — only enforce on new orders to avoid double-counting on edits
      if (!isEdit) {
        await assertStockAvailable(
          validItems.map((i) => ({ item_id: i.productId, quantity: i.quantity, name: i.name }))
        );
      }

      const subtotalCalc = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const diaBase = validItems.reduce((s, i) => s + (Number(i.diaPrice) || 0) * i.quantity, 0);
      const makingBase = validItems.reduce((s, i) => s + (Number(i.makingCharges) || 0) * i.quantity, 0);
      const diaPct = Math.max(0, Math.min(100, Number(diaDiscountPct) || 0));
      const makingPct = Math.max(0, Math.min(100, Number(makingDiscountPct) || 0));
      const diaDiscAmt = diaPct > 0 ? (diaBase * diaPct) / 100 : Math.max(0, Number(diaDiscount) || 0);
      const makingDiscAmt = makingPct > 0 ? (makingBase * makingPct) / 100 : Math.max(0, Number(makingDiscount) || 0);
      const discountAmt = Math.min(subtotalCalc, diaDiscAmt + makingDiscAmt);
      const taxableBase = Math.max(0, subtotalCalc - discountAmt);
      // Resolve tax per line via the slab attached to each product
      const discountRatio = subtotalCalc > 0 ? discountAmt / subtotalCalc : 0;
      const taxAmount = validItems.reduce((sum, item) => {
        const product = products.find((p: any) => p.id === item.productId);
        const slab = resolveSlab(product);
        const rate = slab?.total_rate || 0;
        const lineTaxable = item.lineTotal * (1 - discountRatio);
        return sum + (lineTaxable * rate) / 100;
      }, 0);
      const grandTotal = taxableBase + taxAmount;
      const paymentStatus = status === "completed" ? "paid" : status === "cancelled" ? "cancelled" : "pending";

      if (isEdit && order) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            customer_id: customerId,
            status,
            payment_status: paymentStatus,
            subtotal: subtotalCalc,
            tax_amount: taxAmount,
            total_amount: grandTotal,
            discount_amount: discountAmt,
          } as any)
          .eq("id", order.id);
        if (updateError) throw updateError;

        const { error: deleteItemsError } = await supabase.from("order_items").delete().eq("order_id", order.id);
        if (deleteItemsError) throw deleteItemsError;

        const { error: itemErr } = await supabase.from("order_items").insert(
          validItems.map((item) => ({
            order_id: order.id,
            item_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_amount: item.lineTotal,
            tax_amount: 0,
            dia_price: item.diaPrice,
            cs_price: item.csPrice,
            making_charges: item.makingCharges,
          })) as any
        );
        if (itemErr) throw itemErr;
        return;
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const { data: createdOrder, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customerId,
          order_number: orderNumber,
          status,
          payment_status: paymentStatus,
          payment_method: "cash",
          subtotal: subtotalCalc,
          tax_amount: taxAmount,
          total_amount: grandTotal,
          discount_amount: discountAmt,
          created_by: user?.id || "manual-entry",
        } as any)
        .select()
        .single();
      if (error) throw error;

      const { error: itemErr } = await supabase.from("order_items").insert(
        validItems.map((item) => ({
          order_id: createdOrder.id,
          item_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_amount: item.lineTotal,
          tax_amount: 0,
          dia_price: item.diaPrice,
          cs_price: item.csPrice,
          making_charges: item.makingCharges,
        })) as any
      );
      if (itemErr) throw itemErr;

      // Decrement stock via ledger entries
      await recordSaleLedger({
        orderId: createdOrder.id,
        lines: validItems.map((i) => ({ item_id: i.productId, quantity: i.quantity, unit_cost: i.unitPrice })),
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Order updated" : "Order created");
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      onOpenChange(false);
      setCustomerId("");
      setStatus("completed");
      setLineItems([emptyLine()]);
      setDiaDiscount("0");
      setDiaDiscountPct("");
      setMakingDiscount("0");
      setMakingDiscountPct("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = isView ? "View Order" : isEdit ? "Edit Order" : "New Sale";

  const manualPriceRows: ManualPriceRow[] = useMemo(
    () =>
      enrichedItems
        .filter((e) => !!e.product)
        .map((e) => ({
          index: e.index,
          productName: e.product?.name || "",
          sku: e.product?.sku,
          quantity: e.quantity,
          unitPrice: e.unitPrice,
          diaPrice: Number(lineItems[e.index]?.diaPrice) || 0,
          csPrice: Number(lineItems[e.index]?.csPrice) || 0,
          makingCharges: Number(lineItems[e.index]?.makingCharges) || 0,
        })),
    [enrichedItems, lineItems]
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100vh] max-w-[100vw] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>{title}</DialogTitle>
            {isView && order && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInvoiceOpen(true)}
              >
                Generate Invoice
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {order?.order_number && (
            <div>
              <Label>Order #</Label>
              <Input value={order.order_number} disabled />
            </div>
          )}
          <div>
            <Label>Customer *</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={customerId}
                  onValueChange={setCustomerId}
                  options={customers.map((c: any) => ({ value: c.id, label: `${c.name || "—"} (${c.phone})` }))}
                  placeholder="Select customer..."
                  disabled={isView}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateCustomerOpen(true)}
                disabled={isView}
                className="whitespace-nowrap"
              >
                <Plus className="mr-1 h-4 w-4" /> Create customer
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={isView}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="button" variant="outline" onClick={addLineItem} disabled={isView}>
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>

          <Separator />

          <OrderLineItemsSection
            lineItems={lineItems}
            enrichedItems={enrichedItems}
            products={products}
            stockMap={stockMap}
            goldRates={goldRates}
            disabled={isView}
            ignoreStock={isEdit}
            onUpdate={updateLineItem}
            onRemove={removeLineItem}
          />

          <Card className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Dia Discount</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={diaDiscountPct}
                      disabled={isView || (Number(diaDiscount) > 0)}
                      onChange={(e) => { setDiaDiscountPct(e.target.value); if (e.target.value) setDiaDiscount("0"); }}
                      placeholder="%"
                      className="w-24 text-right pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={diaDiscount}
                    disabled={isView || (Number(diaDiscountPct) > 0)}
                    onChange={(e) => { setDiaDiscount(e.target.value); if (e.target.value && Number(e.target.value) > 0) setDiaDiscountPct(""); }}
                    placeholder="Amount"
                    className="w-32 text-right"
                  />
                </div>
              </div>
              {diaDiscAmtDisplay > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Dia Discount{diaPctNum > 0 ? ` (${diaPctNum}%)` : ""}</span>
                  <span>-₹{diaDiscAmtDisplay.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Making Discount</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={makingDiscountPct}
                      disabled={isView || (Number(makingDiscount) > 0)}
                      onChange={(e) => { setMakingDiscountPct(e.target.value); if (e.target.value) setMakingDiscount("0"); }}
                      placeholder="%"
                      className="w-24 text-right pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={makingDiscount}
                    disabled={isView || (Number(makingDiscountPct) > 0)}
                    onChange={(e) => { setMakingDiscount(e.target.value); if (e.target.value && Number(e.target.value) > 0) setMakingDiscountPct(""); }}
                    placeholder="Amount"
                    className="w-32 text-right"
                  />
                </div>
              </div>
              {makingDiscAmtDisplay > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Making Discount{makingPctNum > 0 ? ` (${makingPctNum}%)` : ""}</span>
                  <span>-₹{makingDiscAmtDisplay.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {sgstRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SGST ({sgstRate.toFixed(1)}%)</span>
                  <span className="font-medium">₹{sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {cgstRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CGST ({cgstRate.toFixed(1)}%)</span>
                  <span className="font-medium">₹{cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {igstRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">IGST ({igstRate.toFixed(1)}%)</span>
                  <span className="font-medium">₹{igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {cessRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CESS ({cessRate.toFixed(1)}%)</span>
                  <span className="font-medium">₹{cessAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {sgstRate === 0 && cgstRate === 0 && igstRate === 0 && cessRate === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">₹0</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-base">
                <span className="font-medium">Grand Total</span>
                <span className="font-semibold">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </Card>
        </div>
        <DialogFooter>
          {!isView && !!customerId && lineItems.some((l) => l.productId) && (
            <Button variant="secondary" size="sm" className="mr-auto" onClick={() => setManualPriceOpen(true)}>
              Edit price manually
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isView ? "Close" : "Cancel"}</Button>
          {!isView && (
            <Button onClick={() => createMut.mutate()} disabled={!customerId || createMut.isPending || subtotal <= 0}>
              {createMut.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {isView && order && (
      <InvoiceViewerDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} orderId={order.id} />
    )}
    <ManualPriceOverrideDialog
      open={manualPriceOpen}
      onOpenChange={setManualPriceOpen}
      rows={manualPriceRows}
      onConfirm={(values) => {
        setLineItems((current) =>
          current.map((item, i) => {
            const v = values.find((x) => x.index === i);
            if (!v) return item;
            return {
              ...item,
              unitPriceOverride: v.unitPrice,
              diaPrice: v.diaPrice,
              csPrice: v.csPrice,
              makingCharges: v.makingCharges,
            };
          })
        );
      }}
    />
    {createCustomerOpen && (
      <Suspense fallback={null}>
        <CustomerFormDialog
          open={createCustomerOpen}
          onOpenChange={(o) => {
            setCreateCustomerOpen(o);
            if (!o) qc.invalidateQueries({ queryKey: ["order-form-customers"] });
          }}
          customer={null}
          mode="create"
        />
      </Suspense>
    )}
  </>
  );
}
