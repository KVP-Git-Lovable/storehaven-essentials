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
import { ArrowLeft, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { ENTITY_LIST, ENTITY_SCHEMAS, type EntityKey, type FilterCondition } from "@/lib/listViewSchema";
import { FilterRow } from "@/components/listviews/FilterRow";
import { executeListView } from "@/lib/listViewExecutor";

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
      setSelectedFields(existing.selected_fields || []);
      setFilters(existing.filters || []);
      setVisibility(existing.visibility);
      setTags((existing.tags || []).join(", "));
    }
  }, [existing]);

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
    if (selectedFields.length) return selectedFields;
    return entity.fields.slice(0, 5).map((f) => f.key);
  }, [selectedFields, entity]);

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
              <Select value={entityType} onValueChange={(v) => { setEntityType(v as EntityKey); setSelectedFields([]); setFilters([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_LIST.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label}{!e.isAudienceSource && " (analytics only)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!entity.isAudienceSource && (
                <p className="text-xs text-muted-foreground mt-1">This entity isn't an audience source — you can use it for reporting but not directly enroll contacts in journeys.</p>
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
              <Button size="sm" variant="outline" onClick={() => setFilters([...filters, { field: entity.fields[0].key, operator: "eq", value: "" }])}>
                <Plus className="mr-2 h-4 w-4" /> Add filter
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {filters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No filters — all rows will match.</p>
              ) : (
                filters.map((f, idx) => (
                  <FilterRow
                    key={idx}
                    entity={entity}
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
              <CardTitle>Preview</CardTitle>
              <Badge variant="secondary">
                {previewQuery.isLoading ? "Loading..." : previewQuery.error ? "Error" : `${previewQuery.data?.count ?? 0} matching`}
              </Badge>
            </CardHeader>
            <CardContent>
              {previewQuery.error ? (
                <p className="text-sm text-destructive">{(previewQuery.error as any).message}</p>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewColumns.map((c) => <TableHead key={c}>{entity.fields.find((f) => f.key === c)?.label || c}</TableHead>)}
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
