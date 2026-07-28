import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrderLineItemsSection } from "@/components/transactions/OrderLineItemsSection";
import { ManualPriceOverrideDialog, type ManualPriceRow } from "@/components/transactions/ManualPriceOverrideDialog";
import { useOrderPricing, useOrderLineItems, emptyLine } from "@/hooks/useOrderPricing";

const CustomerFormDialog = lazy(() =>
  import("@/components/transactions/CustomerFormDialog").then((m) => ({ default: m.CustomerFormDialog }))
);

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function SalesReturnDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [manualPriceOpen, setManualPriceOpen] = useState(false);

  const [diaDiscount, setDiaDiscount] = useState("0");
  const [diaDiscountPct, setDiaDiscountPct] = useState("");
  const [makingDiscount, setMakingDiscount] = useState("0");
  const [makingDiscountPct, setMakingDiscountPct] = useState("");

  const pricing = useOrderPricing(open);
  const { products, stockMap, goldRates, resolveSlab, unitPriceOf } = pricing;
  const purchase = useOrderLineItems(pricing, { diaDiscount, diaDiscountPct, makingDiscount, makingDiscountPct });

  useEffect(() => {
    if (open) return;
    setCustomerId("");
    setOrderId("");
    setSelectedItemIds([]);
    setNotes("");
    setPaymentMethod("cash");
    setDiaDiscount("0");
    setDiaDiscountPct("");
    setMakingDiscount("0");
    setMakingDiscountPct("");
    purchase.setLineItems([emptyLine()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: customers = [] } = useQuery({
    queryKey: ["order-form-customers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").order("name").limit(1000);
      return data || [];
    },
  });

  const { data: customerOrders = [] } = useQuery({
    queryKey: ["sales-return-orders", customerId],
    enabled: open && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, invoice_number, total_amount, created_at")
        .eq("customer_id", customerId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: ["sales-return-order-items", orderId],
    enabled: open && !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, item_id, quantity, unit_price, dia_price, cs_price, making_charges, total_amount")
        .eq("order_id", orderId);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.item_id).filter(Boolean);
      let itemsById = new Map<string, any>();
      if (ids.length) {
        const { data: inv } = await supabase
          .from("inventory_items")
          .select(
            "id, name, sku, category, gross_wt, net_wt, total_colour_stone_wt, total_diamond_wt, main_metal, tax_master_id"
          )
          .in("id", ids);
        itemsById = new Map((inv || []).map((r: any) => [r.id, r]));
      }
      return (data || []).map((row: any) => {
        const inv = itemsById.get(row.item_id) || {};
        const qty = Number(row.quantity) || 1;
        const unitPrice = Number(row.unit_price) || 0;
        const dia = Number(row.dia_price) || 0;
        const cs = Number(row.cs_price) || 0;
        const making = Number(row.making_charges) || 0;
        const netWt = Number(inv.net_wt) || 0;
        const metalValue = Math.max(0, unitPrice - dia - cs - making);
        const metalRate = netWt > 0 ? Math.round((metalValue / netWt) * 100) / 100 : 0;
        return {
          orderItemId: row.id,
          itemId: row.item_id,
          sku: inv.sku || "",
          productName: inv.name || "Item",
          category: inv.category || "",
          grossWt: Number(inv.gross_wt) || 0,
          netWt,
          stoneWt: (Number(inv.total_colour_stone_wt) || 0) + (Number(inv.total_diamond_wt) || 0),
          purity: inv.main_metal || "",
          metalRate,
          makingCharges: making,
          diaPrice: dia,
          csPrice: cs,
          taxMasterId: inv.tax_master_id || null,
          quantity: qty,
          unitPrice,
          originalSellingPrice: Number(row.total_amount) || unitPrice * qty,
        };
      });
    },
  });

  const returnRows = useMemo(
    () =>
      invoiceItems.map((it: any) => {
        const slab = resolveSlab({ taxMasterId: it.taxMasterId });
        const rate = slab?.total_rate || 0;
        const base = it.unitPrice * it.quantity;
        const taxAmount = (base * rate) / 100;
        return { ...it, taxRate: rate, taxAmount, lineTotal: base + taxAmount };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoiceItems, pricing.taxSlabs]
  );

  const selectedRows = returnRows.filter((r: any) => selectedItemIds.includes(r.orderItemId));

  const selectedInventoryIds = useMemo(
    () => Array.from(new Set(selectedRows.map((r: any) => r.itemId).filter(Boolean))) as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedItemIds, returnRows]
  );

  const { data: validationRows = [], isFetching: validating } = useQuery({
    queryKey: ["sales-return-validate", selectedInventoryIds],
    enabled: open && selectedInventoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("validate_sales_return_items", {
        _item_ids: selectedInventoryIds,
        _log: false,
        _order_id: orderId || null,
      });
      if (error) throw error;
      return (data || []) as { item_id: string; sku: string | null; is_valid: boolean; reason: string | null }[];
    },
  });

  const invalidByItemId = useMemo(() => {
    const m = new Map<string, string>();
    validationRows.forEach((r) => {
      if (!r.is_valid && r.reason) m.set(r.item_id, r.reason);
    });
    return m;
  }, [validationRows]);

  const hasInvalidItems = selectedRows.some((r: any) => invalidByItemId.has(r.itemId));

  const returnValue = selectedRows.reduce((s: number, r: any) => s + r.lineTotal, 0);
  const purchaseValue = purchase.total;
  const additional = purchaseValue - returnValue;
  const hasPurchase = purchase.lineItems.some((l) => l.productId) && purchaseValue > 0;
  const shortfall = hasPurchase && selectedRows.length > 0 && purchaseValue < returnValue - 0.01;

  const manualPriceRows: ManualPriceRow[] = purchase.enrichedItems
    .filter((e: any) => !!e.product)
    .map((e: any) => ({
      index: e.index,
      productName: e.product?.name || "",
      sku: e.product?.sku,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      diaPrice: Number(purchase.lineItems[e.index]?.diaPrice) || 0,
      csPrice: Number(purchase.lineItems[e.index]?.csPrice) || 0,
      makingCharges: Number(purchase.lineItems[e.index]?.makingCharges) || 0,
    }));

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Customer is required");
      if (!orderId) throw new Error("Select the original sales invoice");
      if (selectedRows.length === 0) throw new Error("Select at least one item to return");

      const purchaseItems = purchase.lineItems
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
            item_id: item.productId,
            quantity,
            unit_price: unitPrice,
            total_amount: unitPrice * quantity,
            dia_price: dia,
            cs_price: cs,
            making_charges: making,
          };
        })
        .filter((i) => i.item_id && i.unit_price > 0);

      if (purchaseItems.length === 0) throw new Error("Add at least one new purchase item");
      if (purchaseValue < returnValue - 0.01) {
        throw new Error(
          "The purchase value must be greater than or equal to the return value. Cash refunds and store credit are not supported."
        );
      }

      const returnPayload = selectedRows.map((r: any) => ({
        order_item_id: r.orderItemId,
        item_id: r.itemId,
        sku: r.sku,
        product_name: r.productName,
        category: r.category,
        gross_wt: r.grossWt,
        net_wt: r.netWt,
        stone_wt: r.stoneWt,
        purity: r.purity,
        metal_rate: r.metalRate,
        making_charges: r.makingCharges,
        dia_price: r.diaPrice,
        cs_price: r.csPrice,
        tax_amount: r.taxAmount,
        original_selling_price: r.originalSellingPrice,
        quantity: r.quantity,
        unit_price: r.unitPrice,
        line_total: r.lineTotal,
      }));

      const { data, error } = await (supabase as any).rpc("process_sales_return", {
        p_customer_id: customerId,
        p_order_id: orderId,
        p_return_items: returnPayload,
        p_purchase_items: purchaseItems,
        p_purchase_subtotal: purchase.subtotal,
        p_purchase_discount: purchase.discountAmount,
        p_purchase_tax: purchase.taxAmount,
        p_purchase_total: purchaseValue,
        p_payment_method: additional > 0 ? paymentMethod : "none",
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Sales return ${data?.return_number || ""} saved`);
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save sales return"),
  });

  const toggleItem = (id: string, checked: boolean) =>
    setSelectedItemIds((cur) => (checked ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>New Sales Return</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer */}
            <div>
              <Label>Customer *</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={customerId}
                    onValueChange={(v) => {
                      setCustomerId(v);
                      setOrderId("");
                      setSelectedItemIds([]);
                    }}
                    options={customers.map((c: any) => ({ value: c.id, label: `${c.name || "—"} (${c.phone})` }))}
                    placeholder="Select customer..."
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateCustomerOpen(true)}
                  className="whitespace-nowrap"
                >
                  <Plus className="mr-1 h-4 w-4" /> Create customer
                </Button>
              </div>
            </div>

            {/* Original invoice */}
            <div>
              <Label>Original Sales Invoice *</Label>
              <SearchableSelect
                value={orderId}
                onValueChange={(v) => {
                  setOrderId(v);
                  setSelectedItemIds([]);
                }}
                options={customerOrders.map((o: any) => ({
                  value: o.id,
                  label: `${o.invoice_number || o.order_number} — ${inr(Number(o.total_amount))} — ${format(
                    new Date(o.created_at),
                    "dd MMM yyyy"
                  )}`,
                }))}
                placeholder={customerId ? "Select invoice..." : "Select a customer first"}
                disabled={!customerId}
              />
            </div>

            {/* Returned items */}
            {!!orderId && (
              <Card className="p-0 overflow-x-auto">
                <div className="p-4 pb-2">
                  <h3 className="text-sm font-semibold">Returned Items</h3>
                  <p className="text-xs text-muted-foreground">Values are locked to the original invoice.</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>LL Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Gross Wt</TableHead>
                      <TableHead className="text-right">Net Wt</TableHead>
                      <TableHead className="text-right">Stone Wt</TableHead>
                      <TableHead>Purity</TableHead>
                      <TableHead className="text-right">Metal Rate</TableHead>
                      <TableHead className="text-right">Making</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Original Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-6 text-muted-foreground">
                          No items on this invoice.
                        </TableCell>
                      </TableRow>
                    ) : (
                      returnRows.map((r: any) => (
                        <TableRow key={r.orderItemId}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItemIds.includes(r.orderItemId)}
                              onCheckedChange={(c) => toggleItem(r.orderItemId, !!c)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">{r.sku || "—"}</TableCell>
                          <TableCell>{r.productName}</TableCell>
                          <TableCell className="text-xs">{r.category || "—"}</TableCell>
                          <TableCell className="text-right">{r.grossWt || "—"}</TableCell>
                          <TableCell className="text-right">{r.netWt || "—"}</TableCell>
                          <TableCell className="text-right">{r.stoneWt || "—"}</TableCell>
                          <TableCell className="text-xs">{r.purity || "—"}</TableCell>
                          <TableCell className="text-right">{r.metalRate ? inr(r.metalRate) : "—"}</TableCell>
                          <TableCell className="text-right">{inr(r.makingCharges)}</TableCell>
                          <TableCell className="text-right">{inr(r.taxAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{inr(r.lineTotal)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* New purchase */}
            {selectedRows.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">New Purchase (Exchange)</h3>
                    <p className="text-xs text-muted-foreground">
                      Add the items the customer is buying against this return.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={purchase.addLineItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Product
                  </Button>
                </div>

                <OrderLineItemsSection
                  lineItems={purchase.lineItems}
                  enrichedItems={purchase.enrichedItems}
                  products={products}
                  stockMap={stockMap}
                  goldRates={goldRates}
                  onUpdate={purchase.updateLineItem}
                  onRemove={purchase.removeLineItem}
                />

                <Card className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Purchase Subtotal</span>
                      <span className="font-medium">{inr(purchase.subtotal)}</span>
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
                            disabled={Number(diaDiscount) > 0}
                            onChange={(e) => {
                              setDiaDiscountPct(e.target.value);
                              if (e.target.value) setDiaDiscount("0");
                            }}
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
                          disabled={Number(diaDiscountPct) > 0}
                          onChange={(e) => {
                            setDiaDiscount(e.target.value);
                            if (e.target.value && Number(e.target.value) > 0) setDiaDiscountPct("");
                          }}
                          placeholder="Amount"
                          className="w-32 text-right"
                        />
                      </div>
                    </div>
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
                            disabled={Number(makingDiscount) > 0}
                            onChange={(e) => {
                              setMakingDiscountPct(e.target.value);
                              if (e.target.value) setMakingDiscount("0");
                            }}
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
                          disabled={Number(makingDiscountPct) > 0}
                          onChange={(e) => {
                            setMakingDiscount(e.target.value);
                            if (e.target.value && Number(e.target.value) > 0) setMakingDiscountPct("");
                          }}
                          placeholder="Amount"
                          className="w-32 text-right"
                        />
                      </div>
                    </div>
                    {purchase.sgstRate > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">SGST ({purchase.sgstRate.toFixed(1)}%)</span>
                        <span className="font-medium">{inr(purchase.sgstAmt)}</span>
                      </div>
                    )}
                    {purchase.cgstRate > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">CGST ({purchase.cgstRate.toFixed(1)}%)</span>
                        <span className="font-medium">{inr(purchase.cgstAmt)}</span>
                      </div>
                    )}
                    {purchase.igstRate > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">IGST ({purchase.igstRate.toFixed(1)}%)</span>
                        <span className="font-medium">{inr(purchase.igstAmt)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between text-base">
                      <span className="font-medium">New Purchase Value</span>
                      <span className="font-semibold">{inr(purchaseValue)}</span>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Summary */}
            {selectedRows.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Transaction Summary</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Return Value</p>
                    <p className="text-lg font-semibold">{inr(returnValue)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">New Purchase Value</p>
                    <p className="text-lg font-semibold">{inr(purchaseValue)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Additional Amount Payable</p>
                    <p className="text-lg font-semibold">{inr(Math.max(0, additional))}</p>
                  </div>
                </div>

                {shortfall && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      The purchase value must be greater than or equal to the return value. Cash refunds and store
                      credit are not supported.
                    </span>
                  </div>
                )}

                {additional > 0.01 && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                )}
                {additional <= 0.01 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No additional amount is payable — no payment collection required.
                  </p>
                )}
              </Card>
            )}
          </div>

          <DialogFooter>
            {purchase.lineItems.some((l) => l.productId) && (
              <Button variant="secondary" size="sm" className="mr-auto" onClick={() => setManualPriceOpen(true)}>
                Edit price manually
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={
                !customerId ||
                !orderId ||
                selectedRows.length === 0 ||
                !hasPurchase ||
                shortfall ||
                saveMut.isPending
              }
            >
              {saveMut.isPending ? "Saving..." : "Save Sales Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualPriceOverrideDialog
        open={manualPriceOpen}
        onOpenChange={setManualPriceOpen}
        rows={manualPriceRows}
        onConfirm={(values) => {
          purchase.setLineItems((current) =>
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
