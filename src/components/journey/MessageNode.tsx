import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageSquare, Bell, MessageCircleMore, AlertTriangle } from "lucide-react";
import { WhatsAppIcon } from "@/components/communication/WhatsAppIcon";

const channelIcons: Record<string, any> = { email: Mail, sms: MessageSquare, push: Bell, whatsapp_template: MessageCircleMore };

const freeformChannelMeta: Record<string, { label: string; Icon: any }> = {
  whatsapp: { label: "WhatsApp", Icon: WhatsAppIcon },
  sms: { label: "SMS", Icon: MessageSquare },
  email: { label: "Email", Icon: Mail },
};

export function MessageNode({ data, selected }: NodeProps) {
  const messageType = (data as any).message_type as string | undefined;
  const isFreeform = messageType === "freeform";
  const channel = (data as any).channel || "email";
  const templateId = (data as any).whatsapp_template_id as string | undefined;
  const templateName = (data as any).whatsapp_template_name;
  const Icon = isFreeform ? MessageCircleMore : (channelIcons[channel] || Mail);

  const { data: tmpl } = useQuery({
    queryKey: ["journey-message-node-template", templateId],
    enabled: !isFreeform && channel === "whatsapp_template" && !!templateId,
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
    !isFreeform &&
    channel === "whatsapp_template" &&
    !!templateId &&
    !!tmpl &&
    tmpl.status !== "approved" &&
    !tmpl.user_initiated_approved;

  const freeformChannels: string[] = Array.isArray((data as any).freeform_channels)
    ? (data as any).freeform_channels
    : [];
  const freeformBody = (data as any).freeform_body as string | undefined;

  return (
    <div className={`rounded-lg border-2 bg-background p-4 shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <span className="font-semibold text-sm">{isFreeform ? "Free-form message" : "Message"}</span>
      </div>

      {isFreeform ? (
        <>
          {freeformChannels.length > 0 ? (
            <div className="flex flex-wrap gap-1 mb-1">
              {freeformChannels.map((c) => {
                const meta = freeformChannelMeta[c];
                if (!meta) return null;
                const ChIcon = meta.Icon;
                return (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    <ChIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-destructive">No channels selected</p>
          )}
          {freeformBody && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{freeformBody}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground capitalize">{channel === "whatsapp_template" ? "WhatsApp Template" : channel}</p>
          {channel === "whatsapp_template" && templateName && (
            <p className="text-xs font-medium mt-1">{templateName}</p>
          )}
          {(data as any).template_body && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{(data as any).template_body}</p>
          )}
          {showApprovalWarning && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Template pending Meta approval — messages will fail until approved.</span>
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}
