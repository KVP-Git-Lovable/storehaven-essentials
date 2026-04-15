import { Handle, Position, type NodeProps } from "@xyflow/react";
import { LogOut } from "lucide-react";

export function ExitNode({ selected }: NodeProps) {
  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-muted-foreground"}`}>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-muted"><LogOut className="h-4 w-4 text-muted-foreground" /></div>
        <span className="font-semibold text-sm">Exit</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Journey ends here</p>
    </div>
  );
}
