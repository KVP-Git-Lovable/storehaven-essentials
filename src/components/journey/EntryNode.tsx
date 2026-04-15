import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";

export function EntryNode({ data, selected }: NodeProps) {
  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-green-500"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-green-100"><Users className="h-4 w-4 text-green-600" /></div>
        <span className="font-semibold text-sm">Entry</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{(data as any).segment_type || "All segments"}</p>
      {(data as any).city && <p className="text-xs text-muted-foreground">City: {(data as any).city}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}
