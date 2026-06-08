import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users, Eye, Filter, GitMerge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AudiencePreviewDialog } from "./AudiencePreviewDialog";
import { MultiSegmentPreviewDialog } from "./MultiSegmentPreviewDialog";

const COMBINATOR_LABELS: Record<string, string> = {
  union: "A ∪ B",
  intersection: "A ∩ B",
  difference: "A \\ B",
  only_a: "Only A",
  only_b: "Only B",
};

export function EntryNode({ data, selected }: NodeProps) {
  const d = data as any;
  const audienceConfig = d.audience_config as
    | { segments?: Array<{ key: string; label?: string; list_view_id: string }>; combinator?: string; primary?: string }
    | undefined;
  const isMultiSegment = !!(audienceConfig && Array.isArray(audienceConfig.segments) && audienceConfig.segments.length > 0);

  const listViewId: string | undefined = d.list_view_id;
  const listViewName: string | undefined = d.list_view_name;
  const entityType: string | undefined = d.list_view_entity_type;
  const [count, setCount] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [multiPreviewOpen, setMultiPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isMultiSegment) {
      // Resolve final audience count via journey-actions audience-preview.
      supabase.functions
        .invoke("journey-actions", {
          body: {
            action: "audience-preview",
            audience_config: audienceConfig,
          },
        })
        .then(({ data, error }) => {
          if (cancelled || error) return;
          if (typeof data?.final === "number") setCount(data.final);
        })
        .catch(() => {});
    } else if (listViewId) {
      supabase.functions
        .invoke("list-view-resolve", { body: { list_view_id: listViewId, mode: "count" } })
        .then(({ data, error }) => {
          if (cancelled || error) return;
          if (typeof data?.count === "number") setCount(data.count);
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [listViewId, isMultiSegment, JSON.stringify(audienceConfig || {})]);

  const isBound = isMultiSegment || !!listViewId;

  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[240px] ${selected ? "border-primary" : "border-green-500"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-green-100"><Users className="h-4 w-4 text-green-600" /></div>
        <span className="font-semibold text-sm">
          {isMultiSegment
            ? "Audience (Multi-segment)"
            : isBound
              ? `${entityType || "Audience"} (Filtered via List View)`
              : "Entry"}
        </span>
      </div>

      {isMultiSegment ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs">
            <GitMerge className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Combine:</span>
            <span className="font-medium">{COMBINATOR_LABELS[audienceConfig!.combinator || "union"]}</span>
          </div>
          <div className="space-y-1">
            {audienceConfig!.segments!.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">{s.key}</Badge>
                <span className="truncate" title={s.label}>{s.label || s.list_view_id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
          {count !== null && (
            <Badge
              variant="secondary"
              className="text-[10px] cursor-pointer hover:bg-secondary/80"
              onClick={(e) => { e.stopPropagation(); setMultiPreviewOpen(true); }}
            >
              {count} contacts
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs w-full"
            onClick={(e) => { e.stopPropagation(); setMultiPreviewOpen(true); }}
          >
            <Eye className="h-3 w-3 mr-1" /> Preview Audience
          </Button>
          <MultiSegmentPreviewDialog
            open={multiPreviewOpen}
            onOpenChange={setMultiPreviewOpen}
            audienceConfig={audienceConfig}
          />
        </div>
      ) : isBound ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">From:</span>
            <span className="font-medium truncate" title={listViewName}>{listViewName || "List View"}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entityType && <Badge variant="outline" className="text-[10px] capitalize">{entityType}</Badge>}
            {count !== null && (
              <Badge
                variant="secondary"
                className="text-[10px] cursor-pointer hover:bg-secondary/80"
                onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
              >
                {count} contacts
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs w-full"
            onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
          >
            <Eye className="h-3 w-3 mr-1" /> Preview Audience
          </Button>
          <AudiencePreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            listViewId={listViewId!}
            listViewName={listViewName}
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground capitalize">{d.segment_type || "All segments"}</p>
          {d.city && <p className="text-xs text-muted-foreground">City: {d.city}</p>}
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}
