import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreVertical, Pencil, Copy, Trash2, ListFilter } from "lucide-react";
import { toast } from "sonner";
import type { EntityKey, FilterCondition } from "@/lib/listViewSchema";
import { NewListViewDialog } from "@/components/listviews/NewListViewDialog";

interface Props {
  entity: EntityKey;
  activeViewId: string | null;
  onApply: (
    viewId: string | null,
    filters: FilterCondition[],
    selectedFields?: string[],
    columnOrder?: string[]
  ) => void;
}

export function EntityListViewsBar({ entity, activeViewId, onApply }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: views = [] } = useQuery({
    queryKey: ["list-views-by-entity", entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("id, name, filters, entity_type, selected_fields, column_order")
        .eq("entity_type", entity)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_views" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List view deleted");
      qc.invalidateQueries({ queryKey: ["list-views-by-entity", entity] });
      onApply(null, [], [], []);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateMut = useMutation({
    mutationFn: async (v: any) => {
      const { data: full, error: fetchErr } = await supabase
        .from("list_views" as any)
        .select("*")
        .eq("id", v.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const src = full as any;
      const { id, created_at, updated_at, ...rest } = src;
      const { error } = await supabase.from("list_views" as any).insert({ ...rest, name: `${src.name} (copy)` } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["list-views-by-entity", entity] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedView = views.find((view: any) => view.id === activeViewId) || null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="h-4 w-4 text-muted-foreground" />
      <div className="flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-md">
        <Select
          value={activeViewId ?? "all"}
          onValueChange={(value) => {
            if (value === "all") {
              onApply(null, [], [], []);
              return;
            }

            const nextView = views.find((view: any) => view.id === value);
            onApply(
              nextView?.id ?? null,
              (nextView?.filters as FilterCondition[]) || [],
              (nextView?.selected_fields as string[]) || [],
              (nextView?.column_order as string[]) || []
            );
          }}
        >
          <SelectTrigger className="h-9 min-w-0">
            <SelectValue placeholder="Choose a list view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All records</SelectItem>
            {views.map((view: any) => (
              <SelectItem key={view.id} value={view.id}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedView ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Manage selected list view">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/list-views/${selectedView.id}?entity=${entity}`)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateMut.mutate(selectedView)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (confirm(`Delete list view "${selectedView.name}"?`)) deleteMut.mutate(selectedView.id);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
        <Plus className="mr-1 h-3 w-3" /> New List View
      </Button>

      {views.length === 0 && <Badge variant="secondary" className="text-xs">No saved views yet</Badge>}

      <NewListViewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lockedEntity={entity}
        onCreated={(id) => navigate(`/list-views/${id}?entity=${entity}`)}
      />
    </div>
  );
}
