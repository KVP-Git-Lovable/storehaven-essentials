import { useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AudiencePreviewDialog } from "./AudiencePreviewDialog";

export function EntryNode({ data, selected }: NodeProps) {
  const d = data as any;
  const listViewId: string | undefined = d.list_view_id;
  const listViewName: string | undefined = d.list_view_name;
  const entityType: string | undefined = d.list_view_entity_type;
  const [count, setCount] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!listViewId) return;
    let cancelled = false;
    supabase.functions
      .invoke("list-view-resolve", { body: { list_view_id: listViewId, mode: "count" } })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        if (typeof data?.count === "number") setCount(data.count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [listViewId]);

  const isBound = !!listViewId;

  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[240px] ${selected ? "border-primary" : "border-green-500"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-green-100"><Users className="h-4 w-4 text-green-600" /></div>
        <span className="font-semibold text-sm">
          {isBound ? `${entityType || "Audience"} (Filtered via List View)` : "Entry"}
        </span>
      </div>

      {isBound ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">From:</span>
            <span className="font-medium truncate" title={listViewName}>{listViewName || "List View"}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {entityType && <Badge variant="outline" className="text-[10px] capitalize">{entityType}</Badge>}
            {count !== null && <Badge variant="secondary" className="text-[10px]">{count} contacts</Badge>}
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
