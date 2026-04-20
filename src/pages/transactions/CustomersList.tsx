import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format } from "date-fns";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { CustomerFormDialog } from "@/components/transactions/CustomerFormDialog";
import { executeListView } from "@/lib/listViewExecutor";
import type { FilterCondition } from "@/lib/listViewSchema";

const PAGE_SIZE = 50;
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const usingListView = activeFilters.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["transactions-customers", search, page, activeViewId, activeFilters],
    queryFn: async () => {
      if (usingListView) {
        const result = await executeListView(
          { entity_type: "customers", filters: activeFilters },
          { limit: 1000 }
        );
        let rows = result.rows;
        if (search.trim()) {
          const s = search.toLowerCase();
          rows = rows.filter((r: any) =>
            (r.name || "").toLowerCase().includes(s) ||
            (r.phone || "").toLowerCase().includes(s) ||
            (r.email || "").toLowerCase().includes(s)
          );
        }
        const count = rows.length;
        const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return { rows: paged, count };
      }
      let q = supabase.from("customers").select("*", { count: "exact" }).order("total_spent", { ascending: false });
      if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">All registered customers, sortable by spend.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Customer
        </Button>
      </div>

      <EntityListViewsBar
        entity="customers"
        activeViewId={activeViewId}
        onApply={(id, filters) => { setActiveViewId(id); setActiveFilters(filters); setPage(0); }}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>Anniversary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No customers found.</TableCell></TableRow>
            ) : (
              data!.rows.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || "—"}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="text-xs">{c.email || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.tier || "—"}</Badge></TableCell>
                  <TableCell className="text-right">{c.total_orders || 0}</TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(c.total_spent) || 0)}</TableCell>
                  <TableCell>{c.date_of_birth ? format(new Date(c.date_of_birth), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>{c.anniversary_date ? format(new Date(c.anniversary_date), "dd MMM yyyy") : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(totalPages, 1)}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
