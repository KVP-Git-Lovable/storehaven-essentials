import { useQuery } from "@tanstack/react-query";
import { getInventoryStockMap } from "@/lib/inventoryStock";

export function useInventoryStockMap(itemIds: string[], enabled = true) {
  const ids = Array.from(new Set(itemIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["inventory-stock-map", ids],
    enabled: enabled && ids.length > 0,
    queryFn: () => getInventoryStockMap(ids),
    staleTime: 15_000,
  });
}