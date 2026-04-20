import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function ProductsList() {
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("*").order("price", { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,category.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Catalogue of available products.</p>
      </div>

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
