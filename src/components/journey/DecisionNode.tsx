import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

export function DecisionNode({ data, selected }: NodeProps) {
  const condition = (data as any).condition || "opened";
  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-purple-500"}`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-purple-100"><GitBranch className="h-4 w-4 text-purple-600" /></div>
        <span className="font-semibold text-sm">Decision</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">If {condition}?</p>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-green-600 font-medium">Yes</span>
        <span className="text-[10px] text-red-600 font-medium">No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%" }} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: "70%" }} className="!bg-red-500 !w-3 !h-3" />
    </div>
  );
}
