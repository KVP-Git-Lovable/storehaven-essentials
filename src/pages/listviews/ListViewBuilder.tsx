import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Settings, Filter as FilterIcon, Copy, Pencil, Columns3, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ENTITY_SCHEMAS, type EntityKey, type FilterCondition } from "@/lib/listViewSchema";
import { executeListView } from "@/lib/listViewExecutor";
import { NewListViewDialog } from "@/components/listviews/NewListViewDialog";
import { FieldPickerDialog } from "@/components/listviews/FieldPickerDialog";
import { FiltersDialog } from "@/components/listviews/FiltersDialog";
import { RenameListViewDialog } from "@/components/listviews/RenameListViewDialog";
import { SharingDialog } from "@/components/listviews/SharingDialog";

export default function ListViewBuilder() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const entityFromQuery = searchParams.get("entity") as EntityKey | null;

  // Legacy /list-views/new → open create modal on the listing page
  const [createOpen, setCreateOpen] = useState(isNew);
  useEffect(() => {
    if (isNew) setCreateOpen(true);
  }, [isNew]);

  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["list-view", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const entityType: EntityKey = (existing?.entity_type as EntityKey) || "customers";
  const entity = ENTITY_SCHEMAS[entityType];
  const selectedFields: string[] = existing?.selected_fields || [];
  const filters: FilterCondition[] = existing?.filters || [];
  const savedOrder: string[] = existing?.column_order || [];

  const columnOrder = useMemo(() => {
    const valid = savedOrder.filter((k) => selectedFields.includes(k));
    const missing = selectedFields.filter((k) => !valid.includes(k));
    return valid.length ? [...valid, ...missing] : selectedFields;
  }, [savedOrder, selectedFields]);

  const displayColumns = columnOrder.length
    ? columnOrder
    : entity.fields.slice(0, 5).map((f) => f.key);

  const availableFilterFields = useMemo(
    () => entity.fields.filter((f) => selectedFields.includes(f.key)),
    [entity, selectedFields]
  );

  const dataQuery = useQuery({
    queryKey: ["list-view-data", id, entityType, selectedFields, filters],
    enabled: !isNew && !!existing,
    queryFn: () =>
      executeListView(
        { entity_type: entityType, selected_fields: selectedFields, filters },
        { limit: 100000 }
      ),
  });

  const updateMut = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase
        .from("list_views" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-view", id] });
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      queryClient.invalidateQueries({ queryKey: ["list-views-by-entity"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  const duplicateMut = useMutation({
    mutationFn: async () => {
      if (!existing) throw new Error("No list view loaded");
      const { data, error } = await supabase
        .from("list_views" as any)
        .insert({
          name: `${existing.name} (Copy)`,
          description: existing.description,
          entity_type: existing.entity_type,
          selected_fields: existing.selected_fields,
          column_order: existing.column_order,
          filters: existing.filters,
          visibility: existing.visibility,
          tags: existing.tags,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      toast.success("Duplicated");
      navigate(`/list-views/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to duplicate"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("list_views" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      toast.success("Deleted");
      navigate("/list-views");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  // Legacy /list-views/new route — show only the create modal over the listing
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/list-views")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">New List View</h1>
        </div>
        <NewListViewDialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) {
              if (entityFromQuery) navigate(`/transactions/${entityFromQuery}`);
              else navigate("/list-views");
            }
          }}
          lockedEntity={entityFromQuery}
          onCreated={(newId) => {
            if (entityFromQuery) navigate(`/transactions/${entityFromQuery}`);
            else navigate(`/list-views/${newId}`, { replace: true });
          }}
        />
      </div>
    );
  }

  if (isLoading || !existing) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  const rows = dataQuery.data?.rows || [];
  const count = dataQuery.data?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/list-views")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{existing.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Badge variant="outline">{entity.label}</Badge>
              <Badge variant="outline" className="capitalize">{existing.visibility}</Badge>
              <span>{count.toLocaleString("en-IN")} matching</span>
              {existing.description && <span className="truncate">• {existing.description}</span>}
            </div>
            {(existing.tags || []).length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {(existing.tags || []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(true)}
            disabled={availableFilterFields.length === 0}
            title={availableFilterFields.length === 0 ? "Add fields first (Gear → Select Fields to Display)" : "Filters"}
          >
            <FilterIcon className="h-4 w-4 mr-1" />
            Filters
            {filters.length > 0 && (
              <Badge variant="secondary" className="ml-2">{filters.length}</Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="List view settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>List view</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => duplicateMut.mutate()}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFieldsOpen(true)}>
                <Columns3 className="mr-2 h-4 w-4" /> Select Fields to Display
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSharingOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" /> Sharing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete list view "${existing.name}"?`)) deleteMut.mutate();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <div className="overflow-auto max-h-[70vh]">
          <Table>
            <TableHeader>
              <TableRow>
                {displayColumns.map((c) => {
                  const label = entity.fields.find((f) => f.key === c)?.label || c;
                  return <TableHead key={c}>{label}</TableHead>;
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={displayColumns.length} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : dataQuery.error ? (
                <TableRow>
                  <TableCell colSpan={displayColumns.length} className="text-center py-8 text-destructive">
                    {(dataQuery.error as any).message}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={displayColumns.length} className="text-center py-8 text-muted-foreground">
                    {selectedFields.length === 0
                      ? "No fields selected. Use the gear menu → Select Fields to Display."
                      : "No matching rows"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any, i: number) => (
                  <TableRow key={i}>
                    {displayColumns.map((c) => (
                      <TableCell key={c} className="text-xs">{formatValue(row[c])}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <FieldPickerDialog
        open={fieldsOpen}
        onOpenChange={setFieldsOpen}
        allFields={entity.fields}
        initialSelected={selectedFields}
        initialOrder={columnOrder}
        onSave={(sel, order) =>
          updateMut.mutate({ selected_fields: sel, column_order: order })
        }
      />

      <FiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        availableFields={availableFilterFields}
        initialFilters={filters}
        onSave={(next) => updateMut.mutate({ filters: next })}
      />

      <RenameListViewDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        initialName={existing.name}
        initialDescription={existing.description || ""}
        initialTags={existing.tags || []}
        onSave={(next) => updateMut.mutate(next)}
      />

      <SharingDialog
        open={sharingOpen}
        onOpenChange={setSharingOpen}
        initialVisibility={existing.visibility}
        onSave={(v) => updateMut.mutate({ visibility: v })}
      />
    </div>
  );
}

function formatValue(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}