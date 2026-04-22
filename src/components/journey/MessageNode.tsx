import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageSquare, Bell, MessageCircleMore, AlertTriangle } from "lucide-react";

const channelIcons: Record<string, any> = { email: Mail, sms: MessageSquare, push: Bell, whatsapp_template: MessageCircleMore };

export function MessageNode({ data, selected }: NodeProps) {
  const channel = (data as any).channel || "email";
  const templateId = (data as any).whatsapp_template_id as string | undefined;
  const templateName = (data as any).whatsapp_template_name;
  const Icon = channelIcons[channel] || Mail;

  const { data: tmpl } = useQuery({
    queryKey: ["journey-message-node-template", templateId],
    enabled: channel === "whatsapp_template" && !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("status, user_initiated_approved")
        .eq("id", templateId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const showApprovalWarning =
    channel === "whatsapp_template" &&
    !!templateId &&
    !!tmpl &&
    tmpl.status !== "approved" &&
    !tmpl.user_initiated_approved;

  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <span className="font-semibold text-sm">Message</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{channel === "whatsapp_template" ? "WhatsApp Template" : channel}</p>
      {channel === "whatsapp_template" && templateName && (
        <p className="text-xs font-medium mt-1">{templateName}</p>
      )}
      {(data as any).template_body && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{(data as any).template_body}</p>
      )}
      {showApprovalWarning && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-[11px] text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Template pending Meta approval — messages will fail until approved.</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}
