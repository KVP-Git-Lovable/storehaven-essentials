import { supabase } from "@/integrations/supabase/client";

type ProductDependencyCounts = {
  orderItems: number;
  layawayItems: number;
  returnItems: number;
  storeTargetProducts: number;
};

export async function getProductDependencyCounts(productId: string): Promise<ProductDependencyCounts> {
  const [orderItemsRes, layawayItemsRes, returnItemsRes, storeTargetProductsRes] = await Promise.all([
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("item_id", productId),
    supabase.from("layaway_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
    supabase.from("return_items").select("id", { count: "exact", head: true }).eq("product_id", productId),
    supabase.from("store_target_products").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);

  return {
    orderItems: orderItemsRes.count || 0,
    layawayItems: layawayItemsRes.count || 0,
    returnItems: returnItemsRes.count || 0,
    storeTargetProducts: storeTargetProductsRes.count || 0,
  };
}

export function getProductDeleteBlockMessage(counts: ProductDependencyCounts) {
  const dependencies = [
    counts.orderItems > 0 ? `${counts.orderItems} order item${counts.orderItems === 1 ? "" : "s"}` : null,
    counts.layawayItems > 0 ? `${counts.layawayItems} layaway item${counts.layawayItems === 1 ? "" : "s"}` : null,
    counts.returnItems > 0 ? `${counts.returnItems} return item${counts.returnItems === 1 ? "" : "s"}` : null,
    counts.storeTargetProducts > 0 ? `${counts.storeTargetProducts} store target record${counts.storeTargetProducts === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  if (!dependencies.length) return null;
  return `This product can't be deleted because it is linked to ${dependencies.join(", ")}. Remove those references first, or keep the product for history.`;
}

export async function deleteProductSafely(productId: string) {
  const counts = await getProductDependencyCounts(productId);
  const blockMessage = getProductDeleteBlockMessage(counts);

  if (blockMessage) {
    throw new Error(blockMessage);
  }

  // Inventory Items is now the source of truth. Best-effort cleanup of the
  // legacy products row too, so manual entries created before the migration
  // are removed from both tables.
  const { error: invErr } = await supabase.from("inventory_items").delete().eq("id", productId);
  if (invErr) throw invErr;
  await supabase.from("products").delete().eq("id", productId);
}