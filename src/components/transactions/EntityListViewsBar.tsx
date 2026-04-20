import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Copy, Trash2, ListFilter } from "lucide-react";
import { toast } from "sonner";
import type { EntityKey, FilterCondition } from "@/lib/listViewSchema";

interface Props {
  entity: EntityKey;
  activeViewId: string | null;
  onApply: (viewId: string | null, filters: FilterCondition[]) => void;
}

export function EntityListViewsBar({ entity, activeViewId, onApply }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: views = [] } = useQuery({
    queryKey: ["list-views-by-entity", entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("id, name, filters, entity_type")
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
      onApply(null, []);
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="h-4 w-4 text-muted-foreground" />
      <Button
        size="sm"
        variant={activeViewId === null ? "default" : "outline"}
        onClick={() => onApply(null, [])}
      >
        All records
      </Button>

      {views.map((v: any) => {
        const isActive = activeViewId === v.id;
        return (
          <div key={v.id} className="flex items-center">
            <Button
              size="sm"
              variant={isActive ? "default" : "outline"}
              className="rounded-r-none"
              onClick={() => onApply(v.id, (v.filters as FilterCondition[]) || [])}
            >
              {v.name}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant={isActive ? "default" : "outline"} className="rounded-l-none border-l-0 px-2">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/list-views/${v.id}?entity=${entity}`)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateMut.mutate(v)}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm(`Delete list view "${v.name}"?`)) deleteMut.mutate(v.id);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <Button size="sm" variant="ghost" onClick={() => navigate(`/list-views/new?entity=${entity}`)}>
        <Plus className="mr-1 h-3 w-3" /> New List View
      </Button>

      {views.length === 0 && <Badge variant="secondary" className="text-xs">No saved views yet</Badge>}
    </div>
  );
}
