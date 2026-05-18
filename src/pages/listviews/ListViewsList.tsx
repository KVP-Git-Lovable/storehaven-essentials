import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, Trash2, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";
import { NewListViewDialog } from "@/components/listviews/NewListViewDialog";

function downloadCustomersTemplate() {
  const headers = [
    "name","phone","email","tier","customer_segment",
    "loyalty_points","store_credit","total_orders","total_spent",
    "date_of_birth","anniversary_date",
  ];
  const sampleRows = [
    ["Akshay Sharma","+919876543210","akshay.sharma@example.com","gold","regular","1200","500.00","15","45000.00","1990-04-12","2018-11-20"],
    ["Riya Kumari","+919812345678","riya.kumari@example.com","silver","new","300","0.00","2","3500.00","1995-05-08","2022-02-14"],
    ["Arjun Patel","+919900112233","arjun.patel@example.com","platinum","vip","8500","2500.00","85","325000.00","1985-06-25","2015-12-05"],
  ];
  const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const csv = [headers, ...sampleRows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers_template_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ListViewsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: views = [], isLoading } = useQuery({
    queryKey: ["list-views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("list_views" as any).insert({
        name: `${v.name} (Copy)`,
        description: v.description,
        entity_type: v.entity_type,
        selected_fields: v.selected_fields,
        filters: v.filters,
        visibility: v.visibility,
        tags: v.tags,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      toast.success("List view duplicated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to duplicate"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_views" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">List Views</h1>
          <p className="text-muted-foreground">Reusable saved filter views across entities. Use them as journey audience segments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadCustomersTemplate}>
            <Download className="mr-2 h-4 w-4" /> Customers Template
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New List View
          </Button>
        </div>
      </div>

      <NewListViewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => navigate(`/list-views/${id}`)}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : views.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No list views yet. Create one to get started.</TableCell></TableRow>
            ) : (
              views.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/list-views/${v.id}`)}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{ENTITY_SCHEMAS[v.entity_type as EntityKey]?.label || v.entity_type}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{v.visibility}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(v.tags || []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(v.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/list-views/${v.id}`)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateMutation.mutate(v)}><Copy className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
