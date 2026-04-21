import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Mail, MessageSquare, Bell, MessageCircleMore } from "lucide-react";

const channelIcons: Record<string, any> = { email: Mail, sms: MessageSquare, push: Bell, whatsapp_template: MessageCircleMore };

export function MessageNode({ data, selected }: NodeProps) {
  const channel = (data as any).channel || "email";
  const templateName = (data as any).whatsapp_template_name;
  const Icon = channelIcons[channel] || Mail;
  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-blue-500"}`}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-blue-100"><Icon className="h-4 w-4 text-blue-600" /></div>
        <span className="font-semibold text-sm">Message</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{channel === "whatsapp_template" ? "WhatsApp Template" : channel}</p>
      {channel === "whatsapp_template" && templateName && (
        <p className="text-xs font-medium mt-1">{templateName}</p>
      )}
      {(data as any).template_body && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{(data as any).template_body}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}
