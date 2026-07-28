import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OrderLineItemsSection } from "@/components/transactions/OrderLineItemsSection";
import { ManualPriceOverrideDialog, type ManualPriceRow } from "@/components/transactions/ManualPriceOverrideDialog";
import { useOrderPricing, useOrderLineItems, emptyLine } from "@/hooks/useOrderPricing";

const CustomerFormDialog = lazy(() =>
  import("@/components/transactions/CustomerFormDialog").then((m) => ({ default: m.CustomerFormDialog }))
);

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

/** Karat purity ratios used to derive the default buy rate from the configured 24K rate. */
export const KARAT_RATIO: Record<string, number> = {
  "24K": 1,
  "22K": 0.916,
  "18K": 0.75,
  "14K": 0.585,
};

export type OldGoldRow = {
  key: string;
  description: string;
  ornamentType: string;
  grossWt: string;
  karat: string;
  measuredPurity: string;
  purchaseRate: string;
  deductions: string;
  remarks: string;
  rateTouched?: boolean;
  purityTouched?: boolean;
};

/** Default measured purity (%) presets derived from the karat ratios. */
export const defaultPurityFor = (karat: string) =>
  String(Math.round((KARAT_RATIO[karat] ?? 1) * 100 * 10) / 10);

const emptyOldGold = (): OldGoldRow => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  ornamentType: "",
  grossWt: "",
  karat: "22K",
  measuredPurity: "91.6",
  purchaseRate: "",
  deductions: "0",
  remarks: "",
});

export function valueOfOldGoldRow(r: OldGoldRow) {
  const gross = Number(r.grossWt) || 0;
  const purity = Number(r.measuredPurity) || 0;
  const rate = Number(r.purchaseRate) || 0;
  const deductions = Number(r.deductions) || 0;
  const fine = (gross * purity) / 100;
  return { fine, value: Math.max(0, fine * rate - deductions) };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function OldGoldExchangeDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [manualPriceOpen, setManualPriceOpen] = useState(false);
  const [oldGoldRows, setOldGoldRows] = useState<OldGoldRow[]>([emptyOldGold()]);

  const [diaDiscount, setDiaDiscount] = useState("0");
  const [diaDiscountPct, setDiaDiscountPct] = useState("");
  const [makingDiscount, setMakingDiscount] = useState("0");
  const [makingDiscountPct, setMakingDiscountPct] = useState("");

  const pricing = useOrderPricing(open);
  const { products, stockMap, goldRates, unitPriceOf } = pricing;
  const purchase = useOrderLineItems(pricing, { diaDiscount, diaDiscountPct, makingDiscount, makingDiscountPct });

  useEffect(() => {
    if (open) return;
    setCustomerId("");
    setNotes("");
    setPaymentMethod("cash");
    setOldGoldRows([emptyOldGold()]);
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

  /** Configured daily old gold purchase rate (24K base). */
  const { data: buyRate24k = 0 } = useQuery({
    queryKey: ["gold-buy-rate-latest"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gold_buy_rates")
        .select("price_per_gram_24k")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Number((data as any)?.price_per_gram_24k) || 0;
    },
  });

  const defaultRateFor = (karat: string) =>
    buyRate24k > 0 ? Math.round(buyRate24k * (KARAT_RATIO[karat] ?? 1) * 100) / 100 : 0;

  // Pre-fill purchase rates from the configured rate until the user edits them.
  useEffect(() => {
    if (!open || buyRate24k <= 0) return;
    setOldGoldRows((rows) =>
      rows.map((r) => (r.rateTouched ? r : { ...r, purchaseRate: String(defaultRateFor(r.karat)) }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyRate24k, open]);

  const updateRow = (index: number, patch: Partial<OldGoldRow>) =>
    setOldGoldRows((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (patch.karat && patch.karat !== r.karat && !r.rateTouched) {
          next.purchaseRate = String(defaultRateFor(patch.karat));
        }
        if (patch.karat && patch.karat !== r.karat && !r.purityTouched) {
          next.measuredPurity = defaultPurityFor(patch.karat);
        }
        if (patch.purchaseRate !== undefined) next.rateTouched = true;
        if (patch.measuredPurity !== undefined) next.purityTouched = true;
        return next;
      })
    );

  const addRow = () =>
    setOldGoldRows((rows) => [
      ...rows,
      { ...emptyOldGold(), purchaseRate: String(defaultRateFor("22K")) },
    ]);
  const removeRow = (index: number) =>
    setOldGoldRows((rows) => (rows.length === 1 ? rows : rows.filter((_, i) => i !== index)));

  const validOldGoldRows = oldGoldRows.filter((r) => (Number(r.grossWt) || 0) > 0 && (Number(r.purchaseRate) || 0) > 0);
  const oldGoldValue = validOldGoldRows.reduce((s, r) => s + valueOfOldGoldRow(r).value, 0);
  const totalFineWt = validOldGoldRows.reduce((s, r) => s + valueOfOldGoldRow(r).fine, 0);

  const purchaseValue = purchase.total;
  const additional = purchaseValue - oldGoldValue;
  const hasPurchase = purchase.lineItems.some((l) => l.productId) && purchaseValue > 0;
  const hasOldGold = validOldGoldRows.length > 0 && oldGoldValue > 0;
  const shortfall = hasPurchase && hasOldGold && purchaseValue < oldGoldValue - 0.01;

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
      if (!hasOldGold) throw new Error("Add at least one old gold item");

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
      if (purchaseValue < oldGoldValue - 0.01) {
        throw new Error(
          "The purchase value must be greater than or equal to the value of the old gold. Cash refunds, wallet balance and store credit are not supported."
        );
      }

      const oldGoldPayload = validOldGoldRows.map((r) => ({
        description: r.description || "Old gold",
        ornament_type: r.ornamentType || null,
        gross_wt: Number(r.grossWt) || 0,
        karat: r.karat || null,
        measured_purity: Number(r.measuredPurity) || 0,
        purchase_rate: Number(r.purchaseRate) || 0,
        deductions: Number(r.deductions) || 0,
        remarks: r.remarks || null,
      }));

      const { data, error } = await (supabase as any).rpc("process_old_gold_exchange", {
        p_customer_id: customerId,
        p_old_gold_items: oldGoldPayload,
        p_purchase_items: purchaseItems,
        p_purchase_subtotal: purchase.subtotal,
        p_purchase_discount: purchase.discountAmount,
        p_purchase_tax: purchase.taxAmount,
        p_purchase_total: purchaseValue,
        p_payment_method: additional > 0.01 ? paymentMethod : "none",
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Old gold exchange ${data?.exchange_number || ""} saved`);
      qc.invalidateQueries({ queryKey: ["old-gold-exchanges"] });
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-stock-map"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save old gold exchange"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>New Old Gold Exchange</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer */}
            <div>
              <Label>Customer *</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={customerId}
                    onValueChange={setCustomerId}
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

            <Separator />

            {/* Old gold */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Old Gold Received</h3>
                <p className="text-xs text-muted-foreground">
                  Old or melted gold purchased by weight and purity. No LL Code is created.
                  {buyRate24k > 0
                    ? ` Configured 24K buy rate: ₹${buyRate24k.toLocaleString("en-IN")}/g.`
                    : " No daily old gold purchase rate configured — enter the rate manually."}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" /> Add Old Gold
              </Button>
            </div>

            <div className="space-y-3">
              {oldGoldRows.map((row, index) => {
                const { fine, value } = valueOfOldGoldRow(row);
                return (
                  <Card key={row.key} className="p-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_120px_110px_100px_110px_120px_110px_auto] lg:items-start">
                      <div className="min-w-0">
                        <Label>Description {index + 1} *</Label>
                        <Input
                          value={row.description}
                          onChange={(e) => updateRow(index, { description: e.target.value })}
                          placeholder="e.g. Old gold chain"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label>Ornament Type</Label>
                        <Input
                          value={row.ornamentType}
                          onChange={(e) => updateRow(index, { ornamentType: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label>Gross Wt (g) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={row.grossWt}
                          onChange={(e) => updateRow(index, { grossWt: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label>Karat</Label>
                        <Select value={row.karat} onValueChange={(v) => updateRow(index, { karat: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(KARAT_RATIO).map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0">
                        <Label>Purity (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.measuredPurity}
                          onChange={(e) => updateRow(index, { measuredPurity: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label>Rate (₹/g)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.purchaseRate}
                          onChange={(e) => updateRow(index, { purchaseRate: e.target.value })}
                        />
                      </div>
                      <div className="min-w-0">
                        <Label>Deductions (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.deductions}
                          onChange={(e) => updateRow(index, { deductions: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end lg:pt-[26px]">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => removeRow(index)}
                          disabled={oldGoldRows.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <Label>Remarks</Label>
                        <Input
                          value={row.remarks}
                          onChange={(e) => updateRow(index, { remarks: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="rounded-md border p-3 sm:col-span-1">
                        <p className="text-xs text-muted-foreground">Fine Gold Weight</p>
                        <p className="text-sm font-semibold">{fine.toFixed(3)} g</p>
                        <p className="text-[11px] text-muted-foreground">
                          {(Number(row.grossWt) || 0).toFixed(3)}g × {(Number(row.measuredPurity) || 0).toFixed(2)}%
                        </p>
                      </div>
                      <div className="rounded-md border p-3 sm:col-span-1">
                        <p className="text-xs text-muted-foreground">Old Gold Value</p>
                        <p className="text-sm font-semibold">{inr(value)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fine.toFixed(3)}g × ₹{(Number(row.purchaseRate) || 0).toLocaleString("en-IN")} − ₹
                          {(Number(row.deductions) || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {hasOldGold && (
              <Card className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total Fine Gold Weight: <span className="font-medium text-foreground">{totalFineWt.toFixed(3)} g</span>
                  </span>
                  <span className="text-base font-semibold">Total Old Gold Value: {inr(oldGoldValue)}</span>
                </div>
              </Card>
            )}

            {/* New purchase */}
            {hasOldGold && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">New Jewellery Purchase</h3>
                    <p className="text-xs text-muted-foreground">
                      Add the items the customer is buying against this old gold.
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
            {hasOldGold && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Transaction Summary</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Total Old Gold Value</p>
                    <p className="text-lg font-semibold">{inr(oldGoldValue)}</p>
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
                      The purchase value must be greater than or equal to the value of the old gold. Cash refunds,
                      wallet balance and store credit are not supported.
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
              disabled={!customerId || !hasOldGold || !hasPurchase || shortfall || saveMut.isPending}
            >
              {saveMut.isPending ? "Saving..." : "Save Old Gold Exchange"}
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
