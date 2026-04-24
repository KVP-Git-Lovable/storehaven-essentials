import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, Users, Loader2 } from "lucide-react";
import { ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";

export type AudienceSegment = { key: string; label?: string; list_view_id: string };
export type AudienceCombinator = "union" | "intersection" | "difference" | "only_a" | "only_b";
export type AudienceConfig = {
  segments: AudienceSegment[];
  combinator: AudienceCombinator;
  primary?: string;
};

interface Props {
  value: AudienceConfig;
  onChange: (next: AudienceConfig) => void;
}

const SEGMENT_KEYS = ["A", "B"];

export function AudienceBuilder({ value, onChange }: Props) {
  const segments = value.segments || [];
  const combinator = value.combinator || "union";
  const primary = value.primary || "A";

  // Available list views (audience sources only)
  const { data: listViews = [] } = useQuery({
    queryKey: ["audience-builder-list-views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("id, name, entity_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []).filter((v: any) => v.entity_type === "customers" || v.entity_type === "orders") as any[];
    },
  });

  const setSegment = (idx: number, list_view_id: string) => {
    const next = [...segments];
    const key = SEGMENT_KEYS[idx];
    const lv = listViews.find((v: any) => v.id === list_view_id);
    next[idx] = { key, label: lv?.name, list_view_id };
    onChange({ ...value, segments: next });
  };

  const addSegment = () => {
    if (segments.length >= 2) return;
    const next = [...segments, { key: SEGMENT_KEYS[segments.length], label: "", list_view_id: "" }];
    onChange({ ...value, segments: next });
  };

  const removeSegment = (idx: number) => {
    const next = segments.filter((_, i) => i !== idx).map((s, i) => ({ ...s, key: SEGMENT_KEYS[i] }));
    // Reset to union when dropping back to 1 segment
    onChange({
      segments: next,
      combinator: next.length < 2 ? "union" : combinator,
      primary: next.length < 2 ? undefined : primary,
    });
  };

  // Live preview counts (debounced)
  const [preview, setPreview] = useState<{
    perSegment: Record<string, number>;
    intersection: number;
    union: number;
    final: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Trigger preview when segments / combinator / primary change (debounced 400ms)
  const previewKey = useMemo(
    () => JSON.stringify({
      segs: segments.map((s) => s.list_view_id).filter(Boolean),
      combinator,
      primary,
    }),
    [segments, combinator, primary],
  );

  useEffect(() => {
    const validSegments = segments.filter((s) => s.list_view_id);
    if (validSegments.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const { data, error } = await supabase.functions.invoke("journey-actions", {
          body: {
            action: "audience-preview",
            audience_config: { segments: validSegments, combinator, primary },
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setPreview({
          perSegment: data.perSegment || {},
          intersection: data.intersection || 0,
          union: data.union || 0,
          final: data.final || 0,
        });
      } catch (e: any) {
        setPreviewError(e.message || "Failed to load preview");
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const lvOptions = listViews.map((v: any) => ({
    value: v.id,
    label: `${v.name} (${ENTITY_SCHEMAS[v.entity_type as EntityKey]?.label || v.entity_type})`,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Audience Segments</Label>
        {segments.length < 2 && segments[0]?.list_view_id && (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={addSegment}>
            <Plus className="h-3 w-3 mr-1" /> Add segment
          </Button>
        )}
      </div>

      {/* Segments */}
      <div className="space-y-2">
        {(segments.length === 0 ? [{ key: "A", list_view_id: "" }] : segments).map((seg, idx) => (
          <div key={seg.key} className="flex items-start gap-2 rounded-md border p-2.5">
            <Badge variant="outline" className="mt-1.5 shrink-0 font-mono">{seg.key}</Badge>
            <div className="flex-1 space-y-1.5">
              <SearchableSelect
                value={seg.list_view_id}
                onValueChange={(v) => {
                  if (segments.length === 0) {
                    const lv = (listViews as any[]).find((x) => x.id === v);
                    onChange({ ...value, segments: [{ key: "A", list_view_id: v, label: lv?.name }] });
                  } else {
                    setSegment(idx, v);
                  }
                }}
                options={lvOptions}
                placeholder="Select a list view..."
                searchPlaceholder="Search list views..."
                emptyMessage="No customer or order list views yet"
              />
              {seg.list_view_id && preview?.perSegment[seg.key] !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{preview.perSegment[seg.key].toLocaleString()} contacts</span>
                </div>
              )}
            </div>
            {segments.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeSegment(idx)}
                aria-label={`Remove segment ${seg.key}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Combinator */}
      {segments.length >= 2 && segments.every((s) => s.list_view_id) && (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs">Combine using</Label>
          <RadioGroup
            value={combinator}
            onValueChange={(v) => onChange({ ...value, combinator: v as AudienceCombinator, primary: v === "difference" ? (primary || "A") : undefined })}
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="union" id="cmb-union" />
              <span>Union (A ∪ B) — all unique contacts</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="intersection" id="cmb-int" />
              <span>Intersection (A ∩ B) — contacts in both</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="difference" id="cmb-diff" />
              <span>Difference (A \ B) — in A but not in B</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="only_a" id="cmb-onlya" />
              <span>Only Segment A</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="only_b" id="cmb-onlyb" />
              <span>Only Segment B</span>
            </label>
          </RadioGroup>

          {combinator === "difference" && (
            <div className="pt-1.5 border-t">
              <Label className="text-xs">Keep contacts from</Label>
              <RadioGroup
                value={primary}
                onValueChange={(v) => onChange({ ...value, primary: v })}
                className="flex gap-3 mt-1"
              >
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <RadioGroupItem value="A" id="pri-a" />
                  <span>A</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <RadioGroupItem value="B" id="pri-b" />
                  <span>B</span>
                </label>
              </RadioGroup>
            </div>
          )}
        </div>
      )}

      {/* Live preview */}
      {(preview || previewLoading || previewError) && (
        <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Live preview</Label>
            {previewLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {previewError ? (
            <p className="text-xs text-destructive">{previewError}</p>
          ) : preview ? (
            <>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {segments.filter((s) => s.list_view_id).map((s) => (
                  <Badge key={s.key} variant="outline">
                    {s.key}: {(preview.perSegment[s.key] ?? 0).toLocaleString()}
                  </Badge>
                ))}
                {segments.length >= 2 && segments.every((s) => s.list_view_id) && (
                  <>
                    <Badge variant="outline">A∩B: {preview.intersection.toLocaleString()}</Badge>
                    <Badge variant="outline">A∪B: {preview.union.toLocaleString()}</Badge>
                  </>
                )}
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Final audience: </span>
                <span className="font-semibold">{preview.final.toLocaleString()}</span>
                <span className="text-muted-foreground"> unique contacts</span>
              </p>
            </>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Segments must use Customers or Orders list views. Final audience is deduplicated — each contact receives the journey only once.
      </p>
    </div>
  );
}
