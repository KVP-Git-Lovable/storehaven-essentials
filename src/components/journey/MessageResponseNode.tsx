import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageCircle } from "lucide-react";

const CONDITION_LABELS: Record<string, string> = {
  delivered: "Delivered",
  not_delivered: "Not Delivered",
  read: "Read",
  not_read: "Not Read",
  replied: "Replied",
  not_replied: "Not Replied",
  failed: "Failed",
  undelivered: "Undelivered",
};

export function MessageResponseNode({ data, selected }: NodeProps) {
  const d: any = data || {};
  const condition = CONDITION_LABELS[d.condition] || "Read";
  const waitValue = Number(d.wait_value ?? 0);
  const waitUnit = String(d.wait_unit ?? "hours");
  const targetLabel = d.target_node_label || (d.target_node_id ? "Selected template" : "Not configured");
  const waitText =
    waitValue === 0 ? "Immediately" : `Wait ${waitValue} ${waitUnit}`;

  return (
    <div
      className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[220px] ${
        selected ? "border-primary" : "border-teal-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-teal-100">
          <MessageCircle className="h-4 w-4 text-teal-600" />
        </div>
        <span className="font-semibold text-sm">Message Response</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        <span className="text-foreground font-medium">{targetLabel}</span>
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        If <span className="font-medium">{condition}</span> · {waitText}
      </p>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-green-600 font-medium">Yes</span>
        <span className="text-[10px] text-red-600 font-medium">No</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: "30%" }}
        className="!bg-green-500 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: "70%" }}
        className="!bg-red-500 !w-3 !h-3"
      />
    </div>
  );
}