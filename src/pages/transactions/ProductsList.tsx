import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Info, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { ProductFormDialog } from "@/components/transactions/ProductFormDialog";
import { executeListView } from "@/lib/listViewExecutor";
import type { FilterCondition } from "@/lib/listViewSchema";
import { getInventoryStockMap } from "@/lib/inventoryStock";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function ProductsList() {
  const [search, setSearch] = useState("");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("view");

  const usingListView = activeFilters.length > 0;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions-products", search, activeViewId, activeFilters],
    queryFn: async () => {
      let raw: any[] = [];
      if (usingListView) {
        const result = await executeListView({ entity_type: "products", filters: activeFilters }, { limit: 1000 });
        raw = result.rows;
      } else {
        let q = supabase.from("inventory_items").select("*").order("selling_price", { ascending: false });
        if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,category.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) throw error;
        raw = data || [];
      }

      // Normalise inventory_items rows to the legacy product shape used by this page
      let normalised = raw.map((r: any) => ({
        ...r,
        price: Number(r.selling_price ?? r.price ?? 0),
        stock_qty: 0, // filled below from stock_ledger
      }));

      if (search.trim() && usingListView) {
        const s = search.toLowerCase();
        normalised = normalised.filter((p: any) =>
          (p.name || "").toLowerCase().includes(s) ||
          (p.sku || "").toLowerCase().includes(s) ||
          (p.category || "").toLowerCase().includes(s)
        );
      }

      const stockMap = await getInventoryStockMap(normalised.map((r) => r.id));
      return normalised.map((r) => ({ ...r, stock_qty: stockMap[r.id] ?? 0 }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Read-only catalogue of products. Manage items and stock in Inventory.</p>
        </div>
        <Button asChild>
          <Link to="/inventory/items">
            Manage in Inventory Items <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Products are managed in <Link to="/inventory/items" className="underline text-foreground">Inventory → Items</Link>.
          This view is read-only — use it to browse the catalogue and current stock.
        </span>
      </div>

      <EntityListViewsBar
        entity="products"
        activeViewId={activeViewId}
        onApply={(id, filters) => { setActiveViewId(id); setActiveFilters(filters); }}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, SKU, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{rows.length} total</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
            ) : (
              rows.map((p: any) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => { setSelectedProduct(p); setDialogMode("view"); setCreateOpen(true); }}
                >
                  <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category || "—"}</Badge></TableCell>
                  <TableCell>{p.brand || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(p.price))}</TableCell>
                  <TableCell className="text-right">{p.stock_qty ?? 0}</TableCell>
                  <TableCell className="text-xs">{p.created_at ? format(new Date(p.created_at), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon" onClick={() => { setSelectedProduct(p); setDialogMode("view"); setCreateOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ProductFormDialog open={createOpen} onOpenChange={setCreateOpen} product={selectedProduct} mode={dialogMode} />
    </div>
  );
}
