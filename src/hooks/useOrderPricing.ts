import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useInventoryStockMap } from "@/hooks/useInventoryStock";

export type LineItem = {
  productId: string;
  quantity: string;
  diaPrice: string;
  csPrice: string;
  makingCharges: string;
  unitPriceOverride?: string;
  diaDiscountPercent?: string;
  makingDiscountPercent?: string;
};

export const emptyLine = (): LineItem => ({
  productId: "",
  quantity: "1",
  diaPrice: "0",
  csPrice: "0",
  makingCharges: "0",
  diaDiscountPercent: "0",
  makingDiscountPercent: "0",
});

export function karatOf(mainMetal?: string | null): "18K" | "22K" | null {
  if (!mainMetal) return null;
  const s = String(mainMetal).toUpperCase();
  if (s.includes("18")) return "18K";
  if (s.includes("22")) return "22K";
  return null;
}

/**
 * Shared pricing context for Sales Order / Sales Return purchase lines.
 * Single source of truth for products, live rates and tax slabs.
 */
export function useOrderPricing(open: boolean) {
  const { data: products = [] } = useQuery({
    queryKey: ["order-form-products"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select(
          "id, name, sku, selling_price, status, net_wt, gross_wt, main_metal, tax_master_id, total_diamond_wt, total_colour_stone_wt, material_quality, material_inter_quality, category"
        )
        .eq("status", "active")
        .order("name")
        .limit(1000);
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        sku: row.sku || "",
        category: row.category || "",
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
      (data || []).forEach((r: any) => {
        map[r.karat] = Number(r.price_per_gram) || 0;
      });
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

  return {
    products,
    stockMap: stockMap as Record<string, number>,
    goldRates,
    makingRate,
    csRate,
    diamondRateByQuality,
    taxSlabs,
    defaultSlab,
    resolveSlab,
    unitPriceOf,
  };
}

export type OrderPricing = ReturnType<typeof useOrderPricing>;

/**
 * Line item state + auto-fill + totals, shared by Sales Order and Sales Return.
 */
export function useOrderLineItems(pricing: OrderPricing, discounts: {
  diaDiscount: string;
  diaDiscountPct: string;
  makingDiscount: string;
  makingDiscountPct: string;
}) {
  const { products, goldRates, makingRate, csRate, diamondRateByQuality, resolveSlab, unitPriceOf } = pricing;
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setLineItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.productId && patch.productId !== item.productId) {
          next.unitPriceOverride = undefined;
          const product = products.find((p: any) => p.id === patch.productId);
          const netWt = Number(product?.netWt) || 0;
          const currentMaking = Number(item.makingCharges) || 0;
          if (makingRate > 0 && netWt > 0 && currentMaking === 0) {
            next.makingCharges = String(Math.round(makingRate * netWt * 100) / 100);
          }
          const csWt = Number(product?.csWt) || 0;
          const currentCs = Number(item.csPrice) || 0;
          if (csRate > 0 && csWt > 0 && currentCs === 0) {
            next.csPrice = String(Math.round(csRate * csWt * 100) / 100);
          }
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
      })
    );
  };

  const addLineItem = () => setLineItems((current) => [...current, emptyLine()]);
  const removeLineItem = (index: number) =>
    setLineItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));

  const enrichedItems = useMemo(
    () =>
      lineItems.map((item, index) => {
        const product = products.find((p: any) => p.id === item.productId);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const up = unitPriceOf(product);
        const hasOverride = !!item.unitPriceOverride;
        const dia = Number(item.diaPrice) || 0;
        const cs = Number(item.csPrice) || 0;
        const making = Number(item.makingCharges) || 0;
        const unitPrice = hasOverride ? Number(item.unitPriceOverride) || 0 : up.price;

        // Apply line-level discounts
        const diaDiscount = (dia * (Number(item.diaDiscountPercent) || 0)) / 100;
        const makingDiscount = (making * (Number(item.makingDiscountPercent) || 0)) / 100;
        const diaAfterDiscount = Math.max(0, dia - diaDiscount);
        const makingAfterDiscount = Math.max(0, making - makingDiscount);

        const lineTotal = quantity * (unitPrice + diaAfterDiscount + cs + makingAfterDiscount);
        return {
          key: `${index}-${item.productId}`,
          index,
          quantity,
          unitPrice,
          lineTotal,
          priceSource: hasOverride ? ("manual" as const) : up.source,
          product,
          diaBeforeDiscount: dia,
          diaDiscount,
          diaAfterDiscount,
          makingBeforeDiscount: making,
          makingDiscount,
          makingAfterDiscount,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineItems, products, goldRates]
  );

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  // Calculate dia/making base from line-level discounted amounts for subtotal discounts
  const diaBase = enrichedItems.reduce((s, i) => s + i.diaAfterDiscount * i.quantity, 0);
  const makingBase = enrichedItems.reduce((s, i) => s + i.makingAfterDiscount * i.quantity, 0);
  const diaPctNum = Math.max(0, Math.min(100, Number(discounts.diaDiscountPct) || 0));
  const makingPctNum = Math.max(0, Math.min(100, Number(discounts.makingDiscountPct) || 0));
  const diaDiscAmt = diaPctNum > 0 ? (diaBase * diaPctNum) / 100 : Math.max(0, Number(discounts.diaDiscount) || 0);
  const makingDiscAmt =
    makingPctNum > 0 ? (makingBase * makingPctNum) / 100 : Math.max(0, Number(discounts.makingDiscount) || 0);
  const discountAmount = Math.min(subtotal, diaDiscAmt + makingDiscAmt);
  const taxable = Math.max(0, subtotal - discountAmount);
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

  const componentTotals: Record<string, { amount: number; rate: number }> = {};
  enrichedItems.forEach((line) => {
    const slab = resolveSlab(line.product);
    if (!slab) return;
    const lineTaxable = line.lineTotal * (1 - discountRatio);
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

  return {
    lineItems,
    setLineItems,
    updateLineItem,
    addLineItem,
    removeLineItem,
    enrichedItems,
    subtotal,
    diaPctNum,
    makingPctNum,
    diaDiscAmt,
    makingDiscAmt,
    discountAmount,
    taxable,
    sgstAmt,
    sgstRate,
    cgstAmt,
    cgstRate,
    igstAmt,
    igstRate,
    cessAmt,
    cessRate,
    taxAmount,
    total,
  };
}
