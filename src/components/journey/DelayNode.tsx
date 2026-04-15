import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";

export function DelayNode({ data, selected }: NodeProps) {
  const duration = (data as any).duration || 1;
  const unit = (data as any).unit || "days";
  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-orange-500"}`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-orange-100"><Clock className="h-4 w-4 text-orange-600" /></div>
        <span className="font-semibold text-sm">Delay</span>
      </div>
      <p className="text-xs text-muted-foreground">Wait {duration} {unit}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3" />
    </div>
  );
}
