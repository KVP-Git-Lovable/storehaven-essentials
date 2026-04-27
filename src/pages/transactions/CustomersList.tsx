import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { CustomerFormDialog } from "@/components/transactions/CustomerFormDialog";
import { executeListView } from "@/lib/listViewExecutor";
import { ENTITY_SCHEMAS, type FilterCondition } from "@/lib/listViewSchema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SearchColumn = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "enum";
  options?: string[];
};

const SEARCH_COLUMNS: SearchColumn[] = [
  { key: "all", label: "All fields", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "tier", label: "Tier", type: "enum", options: ["bronze", "silver", "gold", "platinum"] },
  { key: "total_orders", label: "Total Orders", type: "number" },
  { key: "total_spent", label: "Total Spent", type: "number" },
  { key: "created_at", label: "Created Date", type: "date" },
  { key: "date_of_birth", label: "DOB", type: "date" },
  { key: "anniversary_date", label: "Anniversary", type: "date" },
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

export default function CustomersList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [activeSelectedFields, setActiveSelectedFields] = useState<string[]>([]);
  const [activeColumnOrder, setActiveColumnOrder] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const [searchColumn, setSearchColumn] = useState<string>("all");
  const activeColumn = SEARCH_COLUMNS.find((c) => c.key === searchColumn) || SEARCH_COLUMNS[0];

  const usingListView = activeViewId !== null;

  // Compute the columns to render: when a list view is active, use its column_order
  // (falling back to selected_fields). Otherwise show the default customer columns.
  const customerEntity = ENTITY_SCHEMAS.customers;
  const fieldLabel = (key: string) =>
    customerEntity.fields.find((f) => f.key === key)?.label || key;

  const DEFAULT_COLUMNS = [
    "name", "phone", "email", "tier", "total_orders",
    "total_spent", "created_at", "date_of_birth", "anniversary_date",
  ];
  const viewColumns = (activeColumnOrder.length ? activeColumnOrder : activeSelectedFields)
    .filter((k) => k !== "id");
  const displayColumns = usingListView && viewColumns.length ? viewColumns : DEFAULT_COLUMNS;

  const renderCell = (col: string, c: any) => {
    const v = c[col];
    switch (col) {
      case "name":
        return <span className="font-medium">{v || "—"}</span>;
      case "tier":
        return <Badge variant="outline" className="capitalize">{v || "—"}</Badge>;
      case "total_orders":
        return v || 0;
      case "total_spent":
      case "store_credit":
        return <span className="font-medium">{inr(Number(v) || 0)}</span>;
      case "loyalty_points":
        return Number(v || 0);
      case "created_at":
      case "date_of_birth":
      case "anniversary_date":
        return v ? format(new Date(v), "dd MMM yyyy") : "—";
      case "email":
        return <span className="text-xs">{v || "—"}</span>;
      default:
        if (v === null || v === undefined || v === "") return "—";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }
  };

  const numericRightAligned = new Set(["total_orders", "total_spent", "loyalty_points", "store_credit"]);


  const applyClientSearch = (rows: any[]) => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    if (searchColumn === "all") {
      return rows.filter((r: any) =>
        (r.name || "").toLowerCase().includes(s) ||
        (r.phone || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s)
      );
    }
    if (activeColumn.type === "date") {
      return rows.filter((r: any) => {
        const v = r[searchColumn];
        if (!v) return false;
        return format(new Date(v), "yyyy-MM-dd") === search;
      });
    }
    if (activeColumn.type === "number") {
      const num = Number(search);
      if (Number.isNaN(num)) return rows;
      return rows.filter((r: any) => Number(r[searchColumn]) === num);
    }
    return rows.filter((r: any) => String(r[searchColumn] ?? "").toLowerCase().includes(s));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transactions-customers", search, searchColumn, page, activeViewId, activeFilters],
    queryFn: async () => {
      if (usingListView) {
        const result = await executeListView(
          { entity_type: "customers", filters: activeFilters },
          { limit: 1000 }
        );
        const rows = applyClientSearch(result.rows);
        const count = rows.length;
        const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return { rows: paged, count };
      }
      let q: any = supabase.from("customers").select("*", { count: "exact" }).order("total_spent", { ascending: false });
      if (search.trim()) {
        if (searchColumn === "all") {
          q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        } else if (activeColumn.type === "date") {
          // exact day match
          q = q.eq(searchColumn, search);
        } else if (activeColumn.type === "number") {
          const num = Number(search);
          if (!Number.isNaN(num)) q = q.eq(searchColumn, num);
        } else if (activeColumn.type === "enum") {
          q = q.eq(searchColumn, search);
        } else {
          q = q.ilike(searchColumn, `%${search}%`);
        }
      }
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["transactions-customers"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete customer"),
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">All registered customers, sortable by spend.</p>
        </div>
        <Button onClick={() => { setSelectedCustomer(null); setDialogMode("create"); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Customer
        </Button>
      </div>

      <EntityListViewsBar
        entity="customers"
        activeViewId={activeViewId}
        onApply={(id, filters, selectedFields, columnOrder) => {
          setActiveViewId(id);
          setActiveFilters(filters);
          setActiveSelectedFields(selectedFields || []);
          setActiveColumnOrder(columnOrder || []);
          setPage(0);
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={searchColumn} onValueChange={(v) => { setSearchColumn(v); setSearch(""); setPage(0); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
              placeholder={searchColumn === "all" ? "Search name, phone, email..." : `Search by ${activeColumn.label}...`}
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
              {displayColumns.map((col) => (
                <TableHead
                  key={col}
                  className={numericRightAligned.has(col) ? "text-right" : undefined}
                >
                  {fieldLabel(col)}
                </TableHead>
              ))}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">No customers found.</TableCell></TableRow>
            ) : (
              data!.rows.map((c: any) => (
                <TableRow key={c.id}>
                  {displayColumns.map((col) => (
                    <TableCell
                      key={col}
                      className={numericRightAligned.has(col) ? "text-right" : undefined}
                    >
                      {renderCell(col, c)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="outline" size="icon" onClick={() => { setSelectedCustomer(c); setDialogMode("view"); setCreateOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => { setSelectedCustomer(c); setDialogMode("edit"); setCreateOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(c)}>
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

      <CustomerFormDialog open={createOpen} onOpenChange={setCreateOpen} customer={selectedCustomer} mode={dialogMode} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name || deleteTarget?.phone || "this customer"}.
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
