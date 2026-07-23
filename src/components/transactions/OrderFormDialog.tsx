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
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { assertStockAvailable, recordSaleLedger } from "@/lib/inventoryStock";
import { useInventoryStockMap } from "@/hooks/useInventoryStock";
import { format } from "date-fns";
import { InvoiceViewerDialog } from "@/components/invoice/InvoiceViewerDialog";
import { CustomerFormDialog } from "@/components/transactions/CustomerFormDialog";

type LineItem = {
  productId: string;
  quantity: string;
  diaPrice: string;
  csPrice: string;
  makingCharges: string;
};

const emptyLine = (): LineItem => ({ productId: "", quantity: "1", diaPrice: "0", csPrice: "0", makingCharges: "0" });

function karatOf(mainMetal?: string | null): "18K" | "22K" | null {
  if (!mainMetal) return null;
  const s = String(mainMetal).toUpperCase();
  if (s.includes("18")) return "18K";
  if (s.includes("22")) return "22K";
  return null;
}

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
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [discount, setDiscount] = useState("0");
  const [discountPct, setDiscountPct] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const { data: customers = [] } = useQuery({
    queryKey: ["order-form-customers"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").order("name").limit(1000);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["order-form-products"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, sku, selling_price, status, net_wt, gross_wt, main_metal, tax_master_id, total_diamond_wt, total_colour_stone_wt, material_quality, material_inter_quality")
        .eq("status", "active")
        .order("name")
        .limit(1000);
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        sku: row.sku || "",
        price: Number(row.selling_price) || 0,
        netWt: Number(row.net_wt) || 0,
        grossWt: Number(row.gross_wt) || 0,
        karat: karatOf(row.main_metal),
        taxMasterId: row.tax_master_id || null,
        diaWt: Number(row.total_diamond_wt) || 0,
        csWt: Number(row.total_colour_stone_wt) || 0,
        materialQuality: (row.material_quality || "").toString().trim(),
        materialInterQuality: (row.material_inter_quality || "").toString().trim(),
      }));
    },
  });

  const productIds = useMemo(() => products.map((p: any) => p.id), [products]);
  const { data: stockMap = {} } = useInventoryStockMap(productIds, open);

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: goldRates = { "14K": 0, "18K": 0, "22K": 0 } } = useQuery({
    queryKey: ["gold-rate-today", today],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gold_rates")
        .select("karat, price_per_gram")
        .eq("rate_date", today);
      if (error) throw error;
      const map: Record<string, number> = { "14K": 0, "18K": 0, "22K": 0 };
      (data || []).forEach((r: any) => { map[r.karat] = Number(r.price_per_gram) || 0; });
      return map;
    },
  });

  const { data: makingRate = 0 } = useQuery({
    queryKey: ["making-rate-latest"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("making_charges_rates")
        .select("price_per_gram")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Number((data as any)?.price_per_gram) || 0;
    },
  });

  // Latest Colour Stone rate (persists until manually changed)
  const { data: csRate = 0 } = useQuery({
    queryKey: ["cs-rate-latest"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cs_rates")
        .select("price_per_gram")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Number((data as any)?.price_per_gram) || 0;
    },
  });

  // Diamond rates keyed by quality → per-carat rate of the first (SR NO 1) row.
  const { data: diamondRateByQuality = {} } = useQuery<Record<string, number>>({
    queryKey: ["diamond-rate-first-by-quality"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diamond_rates")
        .select("quality, price_per_ct, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const q = (r.quality || "").toString().trim().toUpperCase();
        if (!(q in map)) map[q] = Number(r.price_per_ct) || 0;
      });
      return map;
    },
  });

  // Fetch active tax slabs and components for per-line tax calculation
  const { data: taxSlabs = [] } = useQuery({
    queryKey: ["order-form-tax-slabs"],
    enabled: open,
    queryFn: async () => {
      const { data: masters, error } = await (supabase as any)
        .from("tax_masters")
        .select("id, name, is_default, is_active, hsn_code, total_rate")
        .eq("is_active", true);
      if (error) throw error;
      const ids = (masters || []).map((m: any) => m.id);
      const { data: comps } = ids.length
        ? await (supabase as any).from("tax_components").select("*").in("tax_master_id", ids)
        : { data: [] as any[] };
      return (masters || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        is_default: m.is_default,
        hsn_code: m.hsn_code,
        total_rate: Number(m.total_rate) || 0,
        components: (comps || [])
          .filter((c: any) => c.tax_master_id === m.id && c.is_enabled)
          .map((c: any) => ({
            component_type: c.component_type as "CGST" | "SGST" | "IGST" | "CESS",
            percentage: Number(c.percentage) || 0,
          })),
      }));
    },
  });

  const defaultSlab = useMemo(
    () => (taxSlabs as any[]).find((s) => s.is_default) || (taxSlabs as any[])[0] || null,
    [taxSlabs]
  );
  const resolveSlab = (product: any) => {
    if (!product) return defaultSlab;
    if (product.taxMasterId) {
      return (taxSlabs as any[]).find((s) => s.id === product.taxMasterId) || defaultSlab;
    }
    return defaultSlab;
  };

  const unitPriceOf = (product: any): { price: number; source: "gold" | "fallback" } => {
    if (product?.karat && product.netWt > 0 && goldRates[product.karat] > 0) {
      return { price: goldRates[product.karat] * product.netWt, source: "gold" };
    }
    return { price: Number(product?.price) || 0, source: "fallback" };
  };

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
      setDiscount("0");
      setDiscountPct("");
      return;
    }
    setCustomerId(order.customer_id || "");
    setStatus(order.status || "completed");
    setDiscount(String((order as any).discount_amount ?? 0));
    setDiscountPct("");
  }, [open, order]);

  useEffect(() => {
    if (!open || !order?.id) return;
    if (existingOrderItems.length) {
      setLineItems(existingOrderItems.map((item: any) => {
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
      }));
    }
  }, [open, order?.id, existingOrderItems, products, goldRates]);

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const validItems = lineItems
        .map((item) => {
          const product = products.find((p: any) => p.id === item.productId);
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const base = unitPriceOf(product).price;
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

      const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const pct = Math.max(0, Math.min(100, Number(discountPct) || 0));
      const discountAmount = pct > 0
        ? (subtotal * pct) / 100
        : Math.max(0, Number(discount) || 0);
      const taxableBase = Math.max(0, subtotal - discountAmount);
      // Resolve tax per line via the slab attached to each product
      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
      const taxAmount = validItems.reduce((sum, item) => {
        const product = products.find((p: any) => p.id === item.productId);
        const slab = resolveSlab(product);
        const rate = slab?.total_rate || 0;
        const lineTaxable = item.lineTotal * (1 - discountRatio);
        return sum + (lineTaxable * rate) / 100;
      }, 0);
      const total = taxableBase + taxAmount;
      const paymentStatus = status === "completed" ? "paid" : status === "cancelled" ? "cancelled" : "pending";

      if (isEdit && order) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            customer_id: customerId,
            status,
            payment_status: paymentStatus,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            discount_amount: discountAmount,
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
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          discount_amount: discountAmount,
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
      setDiscount("0");
      setDiscountPct("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enrichedItems = useMemo(
    () => lineItems.map((item, index) => {
      const product = products.find((p: any) => p.id === item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const up = unitPriceOf(product);
      const dia = Number(item.diaPrice) || 0;
      const cs = Number(item.csPrice) || 0;
      const making = Number(item.makingCharges) || 0;
      const unitPrice = up.price;
      const lineTotal = quantity * (unitPrice + dia + cs + making);
      return {
        key: `${index}-${item.productId}`,
        index,
        quantity,
        unitPrice,
        lineTotal,
        priceSource: up.source,
        product,
      };
    }),
    [lineItems, products, goldRates]
  );

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const pctNum = Math.max(0, Math.min(100, Number(discountPct) || 0));
  const discountAmount = pctNum > 0
    ? (subtotal * pctNum) / 100
    : Math.max(0, Number(discount) || 0);
  const taxable = Math.max(0, subtotal - discountAmount);
  const discountRatioDisplay = subtotal > 0 ? discountAmount / subtotal : 0;
  const componentTotals: Record<string, { amount: number; rate: number }> = {};
  enrichedItems.forEach((line) => {
    const slab = resolveSlab(line.product);
    if (!slab) return;
    const lineTaxable = line.lineTotal * (1 - discountRatioDisplay);
    slab.components.forEach((c: any) => {
      const key = c.component_type;
      const amt = (lineTaxable * c.percentage) / 100;
      if (!componentTotals[key]) componentTotals[key] = { amount: 0, rate: c.percentage };
      componentTotals[key].amount += amt;
    });
  });
  const sgstAmt = componentTotals.SGST?.amount || 0;
  const sgstRate = componentTotals.SGST?.rate || 0;
  const cgstAmt = componentTotals.CGST?.amount || 0;
  const cgstRate = componentTotals.CGST?.rate || 0;
  const igstAmt = componentTotals.IGST?.amount || 0;
  const igstRate = componentTotals.IGST?.rate || 0;
  const cessAmt = componentTotals.CESS?.amount || 0;
  const cessRate = componentTotals.CESS?.rate || 0;
  const taxAmount = sgstAmt + cgstAmt + igstAmt + cessAmt;
  const total = taxable + taxAmount;
  const title = isView ? "View Order" : isEdit ? "Edit Order" : "New Order";

  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setLineItems((current) => current.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, ...patch };
      if (patch.productId && patch.productId !== item.productId) {
        const product = products.find((p: any) => p.id === patch.productId);
        const netWt = Number(product?.netWt) || 0;
        // Auto-fill Making = today's rate × Net Wt when product is (re)selected,
        // unless the user has already entered a custom Making value.
        const currentMaking = Number(item.makingCharges) || 0;
        if (makingRate > 0 && netWt > 0 && currentMaking === 0) {
          next.makingCharges = String(Math.round(makingRate * netWt * 100) / 100);
        }
        // Auto-fill CS Price = CS rate × Colour Stone Wt.
        const csWt = Number(product?.csWt) || 0;
        const currentCs = Number(item.csPrice) || 0;
        if (csRate > 0 && csWt > 0 && currentCs === 0) {
          next.csPrice = String(Math.round(csRate * csWt * 100) / 100);
        }
        // Auto-fill Dia Price = SR NO 1 rate of matching quality tab × Dia Wt.
        const diaWt = Number(product?.diaWt) || 0;
        const currentDia = Number(item.diaPrice) || 0;
        const q1 = (product?.materialQuality || "").toString().trim().toUpperCase();
        const q2 = (product?.materialInterQuality || "").toString().trim().toUpperCase();
        const matchedQuality = [q1, q2].find((q) => q && (diamondRateByQuality as any)[q] > 0);
        const diaRate = matchedQuality ? (diamondRateByQuality as any)[matchedQuality] : 0;
        if (diaRate > 0 && diaWt > 0 && currentDia === 0) {
          next.diaPrice = String(Math.round(diaRate * diaWt * 100) / 100);
        }
      }
      return next;
    }));
  };

  const addLineItem = () => setLineItems((current) => [...current, emptyLine()]);

  const removeLineItem = (index: number) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1400px]">
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

          <div className="space-y-3">
            {lineItems.map((item, index) => {
              const calculated = enrichedItems[index];
              return (
                <Card key={calculated.key} className="p-4">
                   <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_110px_130px_100px_100px_110px_130px_auto] lg:items-start md:grid-cols-2">
                    <div className="min-w-0">
                      <Label>Product {index + 1}</Label>
                      <SearchableSelect
                        value={item.productId}
                        onValueChange={(value) => updateLineItem(index, { productId: value })}
                        options={products.map((p: any) => {
                          const stock = stockMap[p.id] ?? 0;
                          const sku = p.sku || "";
                          return {
                            value: p.id,
                            label: `${sku ? sku + " — " : ""}${p.name} (Stock: ${stock})`,
                            labelNode: (
                              <span>
                                {sku && <span className="font-mono font-bold">{sku}</span>}
                                {sku && <span> — </span>}
                                <span>{p.name}</span>
                                <span className="text-muted-foreground"> (Stock: {stock})</span>
                              </span>
                            ),
                            searchValue: `${sku} ${p.name} ${stock}`,
                            disabled: !isEdit && stock <= 0,
                          };
                        })}
                        placeholder="Select product..."
                        searchPlaceholder="Search by SKU / Barcode or name..."
                        disabled={isView}
                      />
                      {calculated.product && calculated.priceSource === "fallback" && calculated.product.karat && (
                        <p className="text-[11px] text-muted-foreground mt-1">Set today's gold rate for {calculated.product.karat} to auto-price by weight.</p>
                      )}
                      {calculated.product && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {calculated.product.sku && <span>LL-Code: <span className="font-medium text-foreground">{calculated.product.sku}</span></span>}
                          {calculated.product.netWt > 0 && <span>Net Wt: <span className="font-medium text-foreground">{calculated.product.netWt}g</span></span>}
                          {calculated.product.grossWt > 0 && <span>Gross Wt: <span className="font-medium text-foreground">{calculated.product.grossWt}g</span></span>}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label>Quantity</Label>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={isView} onClick={() => updateLineItem(index, { quantity: String(Math.max(1, (Number(item.quantity) || 1) - 1)) })}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          disabled={isView}
                          onChange={(e) => updateLineItem(index, { quantity: e.target.value })}
                          className="text-center"
                        />
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={isView} onClick={() => updateLineItem(index, { quantity: String((Number(item.quantity) || 1) + 1) })}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <Label>Unit Price</Label>
                      <Input value={`₹${Math.round(calculated.unitPrice).toLocaleString("en-IN")}`} disabled />
                      {calculated.product && calculated.priceSource === "gold" && calculated.product.karat && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {calculated.product.netWt}g × ₹{Math.round(goldRates[calculated.product.karat!] || 0).toLocaleString("en-IN")}/g ({calculated.product.karat})
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Label>Dia Price</Label>
                      <Input type="number" min="0" step="0.01" value={item.diaPrice} disabled={isView} onChange={(e) => updateLineItem(index, { diaPrice: e.target.value })} />
                    </div>
                    <div className="min-w-0">
                      <Label>CS Price</Label>
                      <Input type="number" min="0" step="0.01" value={item.csPrice} disabled={isView} onChange={(e) => updateLineItem(index, { csPrice: e.target.value })} />
                    </div>
                    <div className="min-w-0">
                      <Label>Making</Label>
                      <Input type="number" min="0" step="0.01" value={item.makingCharges} disabled={isView} onChange={(e) => updateLineItem(index, { makingCharges: e.target.value })} />
                    </div>
                    <div className="min-w-0">
                      <Label>Line Total</Label>
                      <Input value={`₹${Math.round(calculated.lineTotal).toLocaleString("en-IN")}`} disabled />
                    </div>
                    <div className="flex justify-end lg:pt-[26px]">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => removeLineItem(index)} disabled={isView || lineItems.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Discount</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountPct}
                      disabled={isView || (Number(discount) > 0)}
                      onChange={(e) => { setDiscountPct(e.target.value); if (e.target.value) setDiscount("0"); }}
                      placeholder="%"
                      className="w-24 text-right pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    disabled={isView || (Number(discountPct) > 0)}
                    onChange={(e) => { setDiscount(e.target.value); if (e.target.value && Number(e.target.value) > 0) setDiscountPct(""); }}
                    placeholder="Amount"
                    className="w-32 text-right"
                  />
                </div>
              </div>
              {pctNum > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Discount ({pctNum}%)</span>
                  <span>-₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
  </>
  );
}
