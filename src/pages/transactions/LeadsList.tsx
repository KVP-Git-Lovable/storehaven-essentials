import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, Plus, Eye, Pencil, Trash2, ArrowRightLeft, CheckCircle2, Upload } from "lucide-react";
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
import { LeadFormDialog, type LeadRow } from "@/components/transactions/LeadFormDialog";
import { LeadConvertDialog } from "@/components/transactions/LeadConvertDialog";
import { LeadImportDialog } from "@/components/transactions/LeadImportDialog";
import { CustomerFormDialog } from "@/components/transactions/CustomerFormDialog";
import { EntityListViewsBar } from "@/components/transactions/EntityListViewsBar";
import { executeListView } from "@/lib/listViewExecutor";
import { ENTITY_SCHEMAS, type FilterCondition } from "@/lib/listViewSchema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDOB } from "@/components/shared/GenderSelect";

const PAGE_SIZE = 50;

export default function LeadsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");
  const [deleteTarget, setDeleteTarget] = useState<LeadRow | null>(null);
  const [convertLead, setConvertLead] = useState<LeadRow | null>(null);
  const [linkedCustomer, setLinkedCustomer] = useState<any | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);
  const [activeSelectedFields, setActiveSelectedFields] = useState<string[]>([]);
  const [activeColumnOrder, setActiveColumnOrder] = useState<string[]>([]);

  const usingListView = activeViewId !== null;

  const leadsEntity = ENTITY_SCHEMAS.leads;
  const fieldLabel = (key: string) => leadsEntity.fields.find((f) => f.key === key)?.label || key;
  const DEFAULT_COLUMNS = ["name", "email", "phone", "city", "state", "country", "date_of_birth", "gender", "is_converted"];
  const viewColumns = (activeColumnOrder.length ? activeColumnOrder : activeSelectedFields).filter((k) => k !== "id");
  const displayColumns = usingListView && viewColumns.length ? viewColumns : DEFAULT_COLUMNS;

  const applyClientSearch = (rows: any[]) => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r: any) =>
      (r.name || "").toLowerCase().includes(s) ||
      (r.phone || "").toLowerCase().includes(s) ||
      (r.email || "").toLowerCase().includes(s) ||
      (r.city || "").toLowerCase().includes(s)
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transactions-leads", search, page, activeViewId, activeFilters],
    queryFn: async () => {
      if (usingListView) {
        const result = await executeListView(
          { entity_type: "leads", filters: activeFilters },
          { limit: 100000 }
        );
        const rows = applyClientSearch(result.rows);
        const count = rows.length;
        const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return { rows: paged as LeadRow[], count };
      }
      let q: any = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (search.trim()) {
        const s = search.trim();
        q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%`);
      }
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as LeadRow[], count: count || 0 };
    },
  });

  const renderCell = (col: string, l: any) => {
    const v = l[col];
    switch (col) {
      case "name":
        return <span className="font-medium">{v || "—"}</span>;
      case "email":
      case "address":
        return <span className="text-xs">{v || "—"}</span>;
      case "is_converted":
        return l.is_converted ? (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Converted</Badge>
        ) : (
          <Badge variant="outline">New</Badge>
        );
      case "created_at":
      case "converted_at":
        return v ? format(new Date(v), "dd MMM yyyy") : "—";
      case "date_of_birth":
        return formatDOB(v);
      case "gender":
        return v || "—";
      default:
        if (v === null || v === undefined || v === "") return "—";
        return String(v);
    }
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["transactions-leads"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  const openLinkedCustomer = async (customerId: string) => {
    const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
    if (!c) {
      toast.error("Linked customer not found");
      return;
    }
    setLinkedCustomer(c);
    setCustomerDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Prospect contacts that can be converted into customers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import Leads
          </Button>
          <Button onClick={() => { setSelected(null); setMode("create"); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Lead
          </Button>
        </div>
      </div>

      <EntityListViewsBar
        entity="leads"
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email, city..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((col) => (
                <TableHead key={col}>{col === "is_converted" ? "Status" : fieldLabel(col)}</TableHead>
              ))}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (data?.rows || []).length === 0 ? (
              <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center py-8 text-muted-foreground">No leads found.</TableCell></TableRow>
            ) : (
              data!.rows.map((l) => (
                <TableRow
                  key={l.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    l.is_converted && "opacity-60 bg-muted/30"
                  )}
                  onClick={() => { setSelected(l); setMode("view"); setFormOpen(true); }}
                >
                  {displayColumns.map((col) => (
                    <TableCell key={col} className={col === "address" ? "max-w-[200px] truncate" : undefined}>
                      {renderCell(col, l)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {l.is_converted ? (
                        l.converted_customer_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLinkedCustomer(l.converted_customer_id!)}
                          >
                            View Customer
                          </Button>
                        )
                      ) : (
                        <Button variant="default" size="sm" onClick={() => setConvertLead(l)}>
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Convert
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => { setSelected(l); setMode("view"); setFormOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={l.is_converted}
                        onClick={() => { setSelected(l); setMode("edit"); setFormOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(l)}>
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

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={selected} mode={mode} />
      <LeadConvertDialog open={!!convertLead} onOpenChange={(o) => !o && setConvertLead(null)} lead={convertLead} />
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CustomerFormDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        customer={linkedCustomer}
        mode="view"
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name || deleteTarget?.phone || "this lead"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
