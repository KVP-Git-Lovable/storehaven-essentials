import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { ProductFormDialog } from "@/components/transactions/ProductFormDialog";
import { executeListView } from "@/lib/listViewExecutor";
import type { FilterCondition } from "@/lib/listViewSchema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function ProductsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const usingListView = activeFilters.length > 0;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions-products", search, activeViewId, activeFilters],
    queryFn: async () => {
      if (usingListView) {
        const result = await executeListView({ entity_type: "products", filters: activeFilters }, { limit: 1000 });
        let r = result.rows;
        if (search.trim()) {
          const s = search.toLowerCase();
          r = r.filter((p: any) =>
            (p.name || "").toLowerCase().includes(s) ||
            (p.sku || "").toLowerCase().includes(s) ||
            (p.category || "").toLowerCase().includes(s)
          );
        }
        return r;
      }
      let q = supabase.from("products").select("*").order("price", { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,category.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["transactions-products"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete product"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Catalogue of available products.</p>
        </div>
        <Button onClick={() => { setSelectedProduct(null); setDialogMode("create"); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Product
        </Button>
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
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category || "—"}</Badge></TableCell>
                  <TableCell>{p.brand || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(p.price))}</TableCell>
                  <TableCell className="text-right">{p.stock_qty ?? 0}</TableCell>
                  <TableCell className="text-xs">{p.created_at ? format(new Date(p.created_at), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon" onClick={() => { setSelectedProduct(p); setDialogMode("view"); setCreateOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => { setSelectedProduct(p); setDialogMode("edit"); setCreateOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name || "this product"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
