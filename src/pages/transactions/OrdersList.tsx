import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Plus, Eye, Pencil, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { OrderFormDialog } from "@/components/transactions/OrderFormDialog";
import { OrderImportDialog } from "@/components/transactions/OrderImportDialog";
import { executeListView } from "@/lib/listViewExecutor";
import type { FilterCondition } from "@/lib/listViewSchema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SearchColumn = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "enum";
  options?: string[];
  // for joined customer fields searched client-side
  clientOnly?: boolean;
};

const SEARCH_COLUMNS: SearchColumn[] = [
  { key: "order_number", label: "Order #", type: "text" },
  { key: "customer_name", label: "Customer Name", type: "text", clientOnly: true },
  { key: "customer_phone", label: "Customer Phone", type: "text", clientOnly: true },
  { key: "status", label: "Status", type: "enum", options: ["pending", "completed", "cancelled", "refunded"] },
  { key: "payment_status", label: "Payment Status", type: "enum", options: ["paid", "pending", "failed", "refunded"] },
  { key: "total_amount", label: "Total Amount", type: "number" },
  { key: "created_at", label: "Order Date", type: "date" },
];
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

const PAGE_SIZE = 50;
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "completed") return "default";
  if (s === "pending") return "secondary";
  if (s === "cancelled") return "destructive";
  return "outline";
};

export default function OrdersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [searchColumn, setSearchColumn] = useState<string>("order_number");
  const activeColumn = SEARCH_COLUMNS.find((c) => c.key === searchColumn) || SEARCH_COLUMNS[0];

  const usingListView = activeFilters.length > 0;

  const applyClientSearch = (rows: any[]) => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    if (searchColumn === "customer_name") {
      return rows.filter((o: any) => (o.customers?.name || "").toLowerCase().includes(s));
    }
    if (searchColumn === "customer_phone") {
      return rows.filter((o: any) => (o.customers?.phone || "").toLowerCase().includes(s));
    }
    if (activeColumn.type === "date") {
      return rows.filter((o: any) => {
        const v = o[searchColumn];
        if (!v) return false;
        return format(new Date(v), "yyyy-MM-dd") === search;
      });
    }
    if (activeColumn.type === "number") {
      const num = Number(search);
      if (Number.isNaN(num)) return rows;
      return rows.filter((o: any) => Number(o[searchColumn]) === num);
    }
    return rows.filter((o: any) => String(o[searchColumn] ?? "").toLowerCase().includes(s));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transactions-orders", search, searchColumn, page, activeViewId, activeFilters],
    queryFn: async () => {
      if (usingListView) {
        const result = await executeListView({ entity_type: "orders", filters: activeFilters }, { limit: 100000 });
        let rows = result.rows;
        // Hydrate customer info first so client-side search on customer fields works
        const customerIds = Array.from(new Set(rows.map((r: any) => r.customer_id).filter(Boolean)));
        if (customerIds.length) {
          const { data: customers } = await supabase.from("customers").select("id, name, phone").in("id", customerIds);
          const byId = new Map((customers || []).map((c: any) => [c.id, c]));
          rows = rows.map((r: any) => ({ ...r, customers: byId.get(r.customer_id) || null }));
        }
        rows = applyClientSearch(rows);
        const orderIds = rows.map((r: any) => r.id);
        if (orderIds.length) {
          const { data: itemCounts } = await supabase
            .from("order_items")
            .select("order_id")
            .in("order_id", orderIds);
          const counts = new Map<string, number>();
          (itemCounts || []).forEach((item: any) => counts.set(item.order_id, (counts.get(item.order_id) || 0) + 1));
          rows = rows.map((r: any) => ({ ...r, item_count: counts.get(r.id) || 0 }));
        }
        const count = rows.length;
        const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return { rows: paged, count };
      }
      let q: any = supabase
        .from("orders")
        .select("*, customers(name, phone)", { count: "exact" })
        .order("created_at", { ascending: false });
      const isClientSearch = activeColumn.clientOnly;
      if (search.trim() && !isClientSearch) {
        if (activeColumn.type === "date") {
          // Match the calendar date by range
          const start = new Date(search + "T00:00:00").toISOString();
          const end = new Date(search + "T23:59:59.999").toISOString();
          q = q.gte(searchColumn, start).lte(searchColumn, end);
        } else if (activeColumn.type === "number") {
          const num = Number(search);
          if (!Number.isNaN(num)) q = q.eq(searchColumn, num);
        } else if (activeColumn.type === "enum") {
          q = q.eq(searchColumn, search);
        } else {
          q = q.ilike(searchColumn, `%${search}%`);
        }
      }
      // For client-only search (customer name/phone), pull a wider set then filter
      if (isClientSearch && search.trim()) {
        q = q.range(0, 999);
      } else {
        q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      let rows: any[] = data || [];
      let total = count || 0;
      if (isClientSearch && search.trim()) {
        rows = applyClientSearch(rows);
        total = rows.length;
        rows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      }
      const orderIds = rows.map((row: any) => row.id);
      if (!orderIds.length) return { rows, count: total };
      const { data: itemCounts, error: itemErr } = await supabase.from("order_items").select("order_id").in("order_id", orderIds);
      if (itemErr) throw itemErr;
      const counts = new Map<string, number>();
      (itemCounts || []).forEach((item: any) => counts.set(item.order_id, (counts.get(item.order_id) || 0) + 1));
      return { rows: rows.map((row: any) => ({ ...row, item_count: counts.get(row.id) || 0 })), count: total };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemError } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (itemError) throw itemError;
      const { error } = await supabase.from("orders").delete().eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order deleted");
      qc.invalidateQueries({ queryKey: ["transactions-orders"] });
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete order"),
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Invoice (Order)</h1>
          <p className="text-muted-foreground">Create and view Sales orders for customers. Sorted by recent first</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import Orders
          </Button>
          <Button onClick={() => { setSelectedOrder(null); setDialogMode("create"); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Sale
          </Button>
        </div>
      </div>

      <EntityListViewsBar
        entity="orders"
        activeViewId={activeViewId}
        onApply={(id, filters) => { setActiveViewId(id); setActiveFilters(filters); setPage(0); }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={searchColumn} onValueChange={(v) => { setSearchColumn(v); setSearch(""); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SEARCH_COLUMNS.map((c) => (
              <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {activeColumn.type === "enum" && activeColumn.options ? (
            <Select value={search} onValueChange={(v) => { setSearch(v); setPage(0); }}>
              <SelectTrigger className="pl-9"><SelectValue placeholder={`Select ${activeColumn.label}...`} /></SelectTrigger>
              <SelectContent>
                {activeColumn.options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={activeColumn.type === "date" ? "date" : activeColumn.type === "number" ? "number" : "text"}
              placeholder={`Search by ${activeColumn.label}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          )}
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders found.</TableCell></TableRow>
            ) : (
              data!.rows.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customers?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.customers?.phone || ""}</div>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(o.status)} className="capitalize">{o.status}</Badge></TableCell>
                  <TableCell className="text-right">{o.item_count || 0}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{o.payment_status || "—"}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{inr(Number(o.total_amount))}</TableCell>
                  <TableCell className="text-xs">{format(new Date(o.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon" onClick={() => { setSelectedOrder(o); setDialogMode("view"); setCreateOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => { setSelectedOrder(o); setDialogMode("edit"); setCreateOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(o)}>
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

      <OrderFormDialog open={createOpen} onOpenChange={setCreateOpen} order={selectedOrder} mode={dialogMode} />
      <OrderImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove order {deleteTarget?.order_number || ""} and its line items.
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
