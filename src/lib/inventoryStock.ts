import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of inventory item id -> available stock derived from stock_ledger.
 * Items with no ledger rows default to 0.
 */
export async function getInventoryStockMap(itemIds: string[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(itemIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("stock_ledger")
    .select("item_id, quantity_change")
    .in("item_id", ids);

  if (error) throw error;

  const map: Record<string, number> = {};
  for (const id of ids) map[id] = 0;
  for (const row of data || []) {
    const id = (row as any).item_id as string;
    map[id] = (map[id] || 0) + Number((row as any).quantity_change || 0);
  }
  return map;
}

/**
 * Throws if any line exceeds available stock.
 * Lines with zero/negative quantity are skipped.
 */
export async function assertStockAvailable(
  lines: { item_id: string; quantity: number; name?: string }[]
): Promise<void> {
  const ids = lines.map((l) => l.item_id).filter(Boolean);
  if (ids.length === 0) return;
  const stock = await getInventoryStockMap(ids);

  // Aggregate quantities per item in case of duplicate lines
  const requested: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const l of lines) {
    if (!l.item_id || l.quantity <= 0) continue;
    requested[l.item_id] = (requested[l.item_id] || 0) + l.quantity;
    if (l.name) labels[l.item_id] = l.name;
  }

  const issues: string[] = [];
  for (const [id, qty] of Object.entries(requested)) {
    const available = stock[id] ?? 0;
    if (qty > available) {
      issues.push(`${labels[id] || id}: requested ${qty}, available ${available}`);
    }
  }
  if (issues.length) {
    throw new Error(`Insufficient stock — ${issues.join("; ")}`);
  }
}

/**
 * Writes negative ledger entries for a sale. Idempotency is the caller's responsibility
 * (e.g. only call after the order row is successfully created).
 */
export async function recordSaleLedger(params: {
  orderId: string;
  storeId?: string | null;
  lines: { item_id: string; quantity: number; unit_cost?: number }[];
}): Promise<void> {
  const rows = params.lines
    .filter((l) => l.item_id && l.quantity > 0)
    .map((l) => ({
      item_id: l.item_id,
      location_type: params.storeId ? "store" : "global",
      location_id: params.storeId ?? null,
      transaction_type: "sale",
      quantity_change: -Math.abs(l.quantity),
      unit_cost: l.unit_cost ?? 0,
      reference_type: "order",
      reference_id: params.orderId,
      created_by: "order-flow",
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("stock_ledger").insert(rows as any);
  if (error) throw error;
}

/**
 * Records a manual stock adjustment (positive or negative) as a single ledger row.
 * Use for the "Edit Stock" UI on Inventory Items.
 */
export async function recordManualAdjustment(params: {
  itemId: string;
  delta: number;
  unitCost?: number;
  notes?: string;
  transactionType?: "manual_adjustment" | "opening_balance";
}): Promise<void> {
  if (!params.itemId || !params.delta) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("stock_ledger").insert([
    {
      item_id: params.itemId,
      location_type: "global",
      location_id: null,
      transaction_type: params.transactionType ?? "manual_adjustment",
      quantity_change: Math.trunc(params.delta),
      unit_cost: params.unitCost ?? 0,
      reference_type: "manual",
      reference_id: null,
      notes: params.notes ?? null,
      created_by: user?.id ?? "manual-adjustment",
    },
  ] as any);
  if (error) throw error;
}