import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ENTITY_LIST, ENTITY_SCHEMAS, type EntityKey, type FilterCondition } from "@/lib/listViewSchema";
import { FilterRow } from "@/components/listviews/FilterRow";
import { executeListView } from "@/lib/listViewExecutor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SortablePreviewHeader } from "@/components/listviews/SortablePreviewHeader";

export default function ListViewBuilder() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const entityFromQuery = searchParams.get("entity") as EntityKey | null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<EntityKey>(entityFromQuery || "customers");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [tags, setTags] = useState<string>("");

  const entity = ENTITY_SCHEMAS[entityType];

  // Load existing view
  const { data: existing } = useQuery({
    queryKey: ["list-view", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("list_views" as any).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || "");
      setEntityType(existing.entity_type);
      const loadedFields: string[] = existing.selected_fields || [];
      const loadedFilters: FilterCondition[] = existing.filters || [];
      // Auto-add fields referenced by filters but missing from selected_fields (backwards-compat)
      const filterFieldKeys = loadedFilters.map((f) => f.field).filter(Boolean);
      const merged = Array.from(new Set([...loadedFields, ...filterFieldKeys]));
      setSelectedFields(merged);
      setFilters(loadedFilters);
      const savedOrder: string[] = existing.column_order || [];
      const validSaved = savedOrder.filter((k) => loadedFields.includes(k));
      const missing = loadedFields.filter((k) => !validSaved.includes(k));
      setColumnOrder(validSaved.length ? [...validSaved, ...missing] : loadedFields);
      setVisibility(existing.visibility);
      setTags((existing.tags || []).join(", "));
    }
  }, [existing]);

  // Keep columnOrder in sync with selectedFields (append new, remove deselected)
  useEffect(() => {
    setColumnOrder((prev) => {
      const filtered = prev.filter((k) => selectedFields.includes(k));
      const additions = selectedFields.filter((k) => !filtered.includes(k));
      const next = [...filtered, ...additions];
      // Avoid no-op state updates
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
      return next;
    });
  }, [selectedFields]);

  // Fields available for filtering = currently selected fields
  const availableFilterFields = useMemo(
    () => entity.fields.filter((f) => selectedFields.includes(f.key)),
    [entity, selectedFields]
  );

  // Auto-prune filter rows whose field was deselected
  useEffect(() => {
    const allowed = new Set(availableFilterFields.map((f) => f.key));
    setFilters((prev) => {
      const next = prev.filter((c) => allowed.has(c.field));
      if (next.length !== prev.length) {
        toast.info(`Removed ${prev.length - next.length} filter(s) on unselected field(s)`);
      }
      return next;
    });
  }, [availableFilterFields]);

  // Live preview
  const previewQuery = useQuery({
    queryKey: ["list-view-preview", entityType, selectedFields, filters],
    queryFn: () => executeListView({ entity_type: entityType, selected_fields: selectedFields, filters }, { limit: 25 }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        entity_type: entityType,
        selected_fields: selectedFields,
        column_order: columnOrder,
        filters,
        visibility,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (isNew) {
        const { data, error } = await supabase.from("list_views" as any).insert({ ...payload, created_by: user?.id } as any).select().single();
        if (error) throw error;
        return data as any;
      } else {
        const { data, error } = await supabase.from("list_views" as any).update(payload as any).eq("id", id).select().single();
        if (error) throw error;
        return data as any;
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["list-views"] });
      queryClient.invalidateQueries({ queryKey: ["list-views-by-entity"] });
      toast.success(isNew ? "List view created" : "List view updated");
      if (entityFromQuery) {
        navigate(`/transactions/${entityFromQuery}`);
      } else {
        navigate(`/list-views/${data.id}`, { replace: true });
      }
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const previewColumns = useMemo(() => {
    if (columnOrder.length) return columnOrder;
    if (selectedFields.length) return selectedFields;
    return entity.fields.slice(0, 5).map((f) => f.key);
  }, [columnOrder, selectedFields, entity]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isReorderable = columnOrder.length > 0;
  const isOrderModified =
    columnOrder.length === selectedFields.length &&
    columnOrder.some((k, i) => k !== selectedFields[i]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/list-views")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isNew ? "New List View" : "Edit List View"}</h1>
            <p className="text-muted-foreground text-sm">Define filters across an entity to build a reusable audience.</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Definition</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., High Value Customers" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Entity</Label>
              <Select
                value={entityType}
                onValueChange={(v) => { setEntityType(v as EntityKey); setSelectedFields([]); setColumnOrder([]); setFilters([]); }}
                disabled={!!entityFromQuery}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_LIST
                    .filter((e) => ["customers", "products", "orders"].includes(e.key))
                    .map((e) => (
                      <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {entityFromQuery && (
                <p className="text-xs text-muted-foreground mt-1">Entity is locked to {entity.label} for this list view.</p>
              )}
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (only me)</SelectItem>
                  <SelectItem value="shared">Shared (everyone)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="marketing, retention" />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Fields</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {entity.fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedFields.includes(f.key)}
                      onCheckedChange={(c) =>
                        setSelectedFields((prev) =>
                          c ? [...prev, f.key] : prev.filter((k) => k !== f.key)
                        )
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Filters</CardTitle>
              <Button
                size="sm"
                variant="outline"
                disabled={availableFilterFields.length === 0}
                title={availableFilterFields.length === 0 ? "Select at least one field first" : undefined}
                onClick={() =>
                  setFilters([
                    ...filters,
                    { field: availableFilterFields[0].key, operator: "eq", value: "" },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add filter
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableFilterFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select fields above to start filtering.</p>
              ) : filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters — all rows will match.</p>
              ) : (
                filters.map((f, idx) => (
                  <FilterRow
                    key={idx}
                    fields={availableFilterFields}
                    value={f}
                    onChange={(next) => setFilters(filters.map((x, i) => (i === idx ? next : x)))}
                    onRemove={() => setFilters(filters.filter((_, i) => i !== idx))}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Preview</CardTitle>
                {isReorderable && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Drag column headers to reorder
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isOrderModified && (
                  <Button size="sm" variant="ghost" onClick={() => setColumnOrder([...selectedFields])}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset order
                  </Button>
                )}
                <Badge variant="secondary">
                  {previewQuery.isLoading ? "Loading..." : previewQuery.error ? "Error" : `${previewQuery.data?.count ?? 0} matching`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {previewQuery.error ? (
                <p className="text-sm text-destructive">{(previewQuery.error as any).message}</p>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableContext items={previewColumns} strategy={horizontalListSortingStrategy}>
                            {previewColumns.map((c) => {
                              const label = entity.fields.find((f) => f.key === c)?.label || c;
                              return isReorderable ? (
                                <SortablePreviewHeader key={c} id={c} label={label} />
                              ) : (
                                <TableHead key={c}>{label}</TableHead>
                              );
                            })}
                          </SortableContext>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(previewQuery.data?.rows || []).map((row: any, i: number) => (
                          <TableRow key={i}>
                            {previewColumns.map((c) => <TableCell key={c} className="text-xs">{formatValue(row[c])}</TableCell>)}
                          </TableRow>
                        ))}
                        {(!previewQuery.data?.rows || previewQuery.data.rows.length === 0) && !previewQuery.isLoading && (
                          <TableRow><TableCell colSpan={previewColumns.length} className="text-center text-muted-foreground py-6">No matching rows</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatValue(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
