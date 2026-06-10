import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Edge, Node } from "@xyflow/react";
import { parseStoredBody, transformTwilioToFriendly } from "@/lib/whatsappVariables";

type FreeformChannel = "whatsapp" | "sms" | "email";
const FREEFORM_CHANNELS: { value: FreeformChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

interface Props {
  node: Node;
  nodes?: Node[];
  edges?: Edge[];
  onUpdate: (id: string, data: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  journeyStatus?: string;
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  body: string;
  category: string;
  language: string;
  status: string;
  user_initiated_approved: boolean;
  twilio_template_type: string | null;
  twilio_media_url: string | null;
  twilio_required_variables: string[] | null;
}

// Variable picker now sourced from VARIABLE_REGISTRY via InsertVariablePicker.

export function NodePropertyPanel({ node, nodes = [], edges = [], onUpdate, onDelete, onClose, journeyStatus }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: approvedWhatsAppTemplates = [], isLoading: loadingWhatsAppTemplates } = useQuery({
    queryKey: ["journey-whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("id, name, body, category, language, status, user_initiated_approved, twilio_template_type, twilio_media_url, twilio_required_variables")
        .or("status.eq.approved,user_initiated_approved.eq.true")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as WhatsAppTemplateOption[];
    },
  });

  const update = (key: string, value: any) => {
    onUpdate(node.id, { ...node.data, [key]: value });
  };

  const selectedWhatsAppTemplate = useMemo(
    () => approvedWhatsAppTemplates.find((template) => template.id === node.data.whatsapp_template_id),
    [approvedWhatsAppTemplates, node.data.whatsapp_template_id]
  );

  const whatsappTemplateParsed = useMemo(() => {
    if (!selectedWhatsAppTemplate) return { body: "", numericToFriendly: null as Record<string, string> | null };
    const { twilioBody, mapping } = parseStoredBody(selectedWhatsAppTemplate.body);
    const body = mapping ? transformTwilioToFriendly(twilioBody, mapping) : twilioBody;
    return { body, numericToFriendly: mapping };
  }, [selectedWhatsAppTemplate]);
  const whatsappTemplateBody = whatsappTemplateParsed.body;
  // friendly_name -> "1"/"2"/...
  const friendlyToNumeric = useMemo(() => {
    const out: Record<string, string> = {};
    if (whatsappTemplateParsed.numericToFriendly) {
      for (const [num, name] of Object.entries(whatsappTemplateParsed.numericToFriendly)) {
        out[name] = num;
      }
    }
    return out;
  }, [whatsappTemplateParsed]);

  const whatsappVariables = useMemo(() => {
    // Accept both Twilio numeric ({{1}}) and friendly ({{name}}) placeholders
    const matches = whatsappTemplateBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    const fromBody = Array.from(matches, (m) => m[1]);
    // Merge with the canonical list synced from Twilio so media/header variables are surfaced too
    const fromSync = Array.isArray(selectedWhatsAppTemplate?.twilio_required_variables)
      ? (selectedWhatsAppTemplate!.twilio_required_variables as string[])
      : [];
    return Array.from(new Set([...fromBody, ...fromSync]));
  }, [whatsappTemplateBody, selectedWhatsAppTemplate]);

  const updateWhatsAppVariable = (name: string, value: string) => {
    const existing = (node.data.template_variables as Record<string, string> | undefined) ?? {};
    const next: Record<string, string> = { ...existing, [name]: value };
    // Mirror to the numeric key Twilio expects (e.g. customer_name -> "1")
    const numKey = friendlyToNumeric[name];
    if (numKey) next[numKey] = value;
    onUpdate(node.id, {
      ...node.data,
      template_variables: next,
    });
  };

  // Build initial template_variables for a template:
  // - Friendly key gets a sensible default token (e.g. customer_name -> {{contact.name}})
  // - Numeric Twilio key (e.g. "1") is mirrored with the same value so whatsapp-send fills it
  const buildInitialVariables = (template: WhatsAppTemplateOption) => {
    const { twilioBody, mapping } = parseStoredBody(template.body);
    const displayBody = mapping ? transformTwilioToFriendly(twilioBody, mapping) : twilioBody;
    const bodyVars = Array.from(displayBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m) => m[1]);
    const syncVars = Array.isArray(template.twilio_required_variables) ? template.twilio_required_variables : [];
    const all = Array.from(new Set([...bodyVars, ...syncVars]));
    // friendly_name -> "1" (inverted from numeric mapping)
    const friendlyToNum: Record<string, string> = {};
    if (mapping) for (const [num, name] of Object.entries(mapping)) friendlyToNum[name] = num;

    const defaultFor = (name: string): string => {
      const lower = name.toLowerCase();
      if (lower === "name" || lower.includes("customer_name") || lower.includes("contact_name") || lower === "first_name") {
        return "{{contact.name}}";
      }
      if (lower.includes("phone")) return "{{contact.phone}}";
      if (lower.includes("email")) return "{{contact.email}}";
      if (lower.includes("city")) return "{{contact.city}}";
      // Fallback: try contact.<name> (resolver will check metadata too)
      return /^\d+$/.test(name) ? "" : `{{contact.${name}}}`;
    };

    const out: Record<string, string> = {};
    for (const v of all) {
      const def = defaultFor(v);
      out[v] = def;
      const num = friendlyToNum[v];
      if (num) out[num] = def;
    }
    return { displayBody, initialVariables: out };
  };

  const handleChannelChange = (value: string) => {
    if (value !== "whatsapp_template") {
      update("channel", value);
      return;
    }

    const firstTemplate = approvedWhatsAppTemplates[0];
    if (!firstTemplate) {
      onUpdate(node.id, {
        ...node.data,
        channel: value,
        whatsapp_template_id: undefined,
        whatsapp_template_name: undefined,
        template_body: "",
        template_variables: {},
      });
      return;
    }

    const { displayBody, initialVariables } = buildInitialVariables(firstTemplate);
    onUpdate(node.id, {
      ...node.data,
      channel: value,
      whatsapp_template_id: firstTemplate.id,
      whatsapp_template_name: firstTemplate.name,
      template_body: displayBody,
      template_variables: initialVariables,
    });
  };

  const handleWhatsAppTemplateChange = (templateId: string) => {
    const template = approvedWhatsAppTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const { displayBody, initialVariables } = buildInitialVariables(template);
    onUpdate(node.id, {
      ...node.data,
      channel: "whatsapp_template",
      whatsapp_template_id: template.id,
      whatsapp_template_name: template.name,
      template_body: displayBody,
      template_variables: initialVariables,
    });
  };

  return (
    <div className="w-72 border-l bg-background p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm capitalize">Edit {String(node.type)}</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        {journeyStatus === "active" || journeyStatus === "paused"
          ? "Changes apply to future executions only. Click Save in the header to persist."
          : "Changes are persisted when you click Save in the header."}
      </p>

      {node.type === "entry" && (
        (node.data as any).audience_config ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-medium">Multi-segment audience</p>
              <p className="text-xs text-muted-foreground">
                This entry node uses a combined audience defined on the journey. To change segments or the combine rule, edit the journey's audience configuration.
              </p>
              <div className="flex flex-wrap gap-1">
                {((node.data as any).audience_config?.segments || []).map((s: any) => (
                  <Badge key={s.key} variant="outline" className="text-[10px]">
                    {s.key}: {s.label || s.list_view_id?.slice(0, 8)}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Combine: <span className="font-mono">{(node.data as any).audience_config?.combinator || "union"}</span>
              </p>
            </div>
          </div>
        ) : node.data.list_view_id ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-medium">Audience controlled by List View</p>
              <p className="text-xs text-muted-foreground">
                This entry node is bound to <span className="font-medium">{String(node.data.list_view_name || "a list view")}</span>.
                To change who enters this journey, edit the list view or pick a different one from the journey toolbar.
              </p>
              <a
                href={`/list-views/${node.data.list_view_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Open List View
              </a>
            </div>
          </div>
        ) : (
          <>
            <div><Label>Segment</Label>
              <Select value={String(node.data.segment_type || "customer")} onValueChange={(v) => update("segment_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="esdb">ESDB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>City Filter</Label>
              <Input value={String(node.data.city || "")} onChange={(e) => update("city", e.target.value)} placeholder="e.g., Mumbai" />
            </div>
          </>
        )
      )}

      {node.type === "message" && (() => {
        const messageType = String(node.data.message_type || "template");
        const freeformChannels: FreeformChannel[] = Array.isArray(node.data.freeform_channels)
          ? (node.data.freeform_channels as FreeformChannel[])
          : ["whatsapp"];
        const toggleFreeformChannel = (ch: FreeformChannel, checked: boolean) => {
          const next = checked
            ? Array.from(new Set([...freeformChannels, ch]))
            : freeformChannels.filter((c) => c !== ch);
          update("freeform_channels", next);
        };
        const handleMessageTypeChange = (value: string) => {
          if (value === "freeform") {
            onUpdate(node.id, {
              ...node.data,
              message_type: "freeform",
              freeform_channels: Array.isArray(node.data.freeform_channels) && node.data.freeform_channels.length > 0
                ? node.data.freeform_channels
                : ["whatsapp"],
              freeform_body: node.data.freeform_body ?? "",
            });
          } else {
            onUpdate(node.id, {
              ...node.data,
              message_type: "template",
              channel: "whatsapp_template",
            });
          }
        };

        return (
          <>
            <div>
              <Label>Message Type</Label>
              <Select value={messageType} onValueChange={handleMessageTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="freeform">Free-form</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType === "template" ? (
              <>
                <div className="space-y-2">
                  <Label>WhatsApp Template</Label>
                  <Select
                    value={String(node.data.whatsapp_template_id || "")}
                    onValueChange={handleWhatsAppTemplateChange}
                    disabled={loadingWhatsAppTemplates || approvedWhatsAppTemplates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingWhatsAppTemplates ? "Loading templates..." : "Select approved template"} />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedWhatsAppTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <span className="flex items-center gap-2">
                            <span>{template.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                                template.status === "approved"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {template.status === "approved" ? "Business" : "User-initiated"}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Includes business-approved templates and user-initiated templates. User-initiated templates can only be sent within 24h of a customer's last inbound message.
                  </p>
                </div>

                {selectedWhatsAppTemplate && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{selectedWhatsAppTemplate.category}</Badge>
                    <Badge variant="secondary">{selectedWhatsAppTemplate.language}</Badge>
                  </div>
                )}

                <div><Label>Message Body</Label>
                  <Textarea value={String(node.data.template_body || whatsappTemplateBody || "")} readOnly placeholder="Select an approved WhatsApp template" rows={4} />
                </div>

                {whatsappVariables.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <Label>Template Variables</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bind each placeholder to a contact field token (e.g. <code>{"{{contact.name}}"}</code>) or type a fixed value.
                      </p>
                    </div>
                    {whatsappVariables.map((variable) => (
                      <div key={variable} className="space-y-1.5">
                        <Label className="text-xs font-mono">{`{{${variable}}}`}</Label>
                        <Input
                          value={String(node.data.template_variables?.[variable] ?? "")}
                          onChange={(e) => updateWhatsAppVariable(variable, e.target.value)}
                          placeholder="e.g. {{contact.name}} or a fixed value"
                        />
                        <div className="flex flex-wrap gap-1 items-center">
                          <InsertVariablePicker
                            onInsert={(name) => updateWhatsAppVariable(variable, `{{${name}}}`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Channels</Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {FREEFORM_CHANNELS.map((c) => (
                      <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={freeformChannels.includes(c.value)}
                          onCheckedChange={(v) => toggleFreeformChannel(c.value, v === true)}
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                  {freeformChannels.length === 0 && (
                    <p className="text-xs text-destructive">Select at least one channel.</p>
                  )}
                </div>

                {freeformChannels.includes("whatsapp") && (
                  <div className="flex items-start gap-1.5 rounded-md border border-orange-200 bg-orange-50 p-2 text-[11px] text-orange-800">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>WhatsApp free-form messages may fail outside the 24h window, as per existing policy from Meta.</span>
                  </div>
                )}

                {freeformChannels.includes("email") && (
                  <div>
                    <Label>Email Subject (optional)</Label>
                    <Input
                      value={String(node.data.freeform_subject || "")}
                      onChange={(e) => update("freeform_subject", e.target.value)}
                      placeholder="Defaults to journey name"
                    />
                  </div>
                )}

                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={String(node.data.freeform_body || "")}
                    onChange={(e) => update("freeform_body", e.target.value)}
                    placeholder="Type your message. Use {{contact.name}} or {name} for personalization. Emojis welcome 👋"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The same message will be used across all selected channels.
                  </p>
                </div>
              </>
            )}
          </>
        );
      })()}

      {node.type === "delay" && (
        <>
          <div><Label>Duration</Label>
            <Input type="number" min={1} value={String(node.data.duration || 1)} onChange={(e) => update("duration", parseInt(e.target.value) || 1)} />
          </div>
          <div><Label>Unit</Label>
            <Select value={String(node.data.unit || "days")} onValueChange={(v) => update("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === "decision" && (() => {
        // Walk upstream to find the nearest message node
        const findUpstreamMessage = (): Node | null => {
          const visited = new Set<string>();
          const queue: string[] = [node.id];
          while (queue.length) {
            const cur = queue.shift()!;
            if (visited.has(cur)) continue;
            visited.add(cur);
            const incoming = edges.filter((e) => e.target === cur);
            for (const e of incoming) {
              const src = nodes.find((n) => n.id === e.source);
              if (!src) continue;
              if (src.type === "message") return src;
              queue.push(src.id);
            }
          }
          return null;
        };
        const upstream = findUpstreamMessage();
        const msgData: any = upstream?.data || {};
        const messageType = String(msgData.message_type || "template");
        // Resolve effective channels for the upstream message
        let channels: string[] = [];
        if (messageType === "template") {
          channels = ["whatsapp"];
        } else if (Array.isArray(msgData.freeform_channels) && msgData.freeform_channels.length) {
          channels = msgData.freeform_channels as string[];
        } else {
          channels = ["email"]; // legacy default
        }
        const has = (c: string) => channels.includes(c);

        // Channel-specific decision options
        type Opt = { value: string; label: string };
        const options: Opt[] = [];
        const seen = new Set<string>();
        const add = (o: Opt) => { if (!seen.has(o.value)) { seen.add(o.value); options.push(o); } };

        if (has("whatsapp")) {
          add({ value: "wa_delivered", label: "WhatsApp Delivered" });
          add({ value: "wa_read", label: "WhatsApp Read" });
          add({ value: "wa_link_clicked", label: "WhatsApp Link Clicked" });
          add({ value: "wa_replied", label: "WhatsApp Replied" });
          add({ value: "wa_failed", label: "WhatsApp Failed / Undelivered" });
        }
        if (has("email")) {
          add({ value: "email_delivered", label: "Email Delivered" });
          add({ value: "email_opened", label: "Email Opened" });
          add({ value: "email_link_clicked", label: "Email Link Clicked" });
          add({ value: "email_replied", label: "Email Replied" });
          add({ value: "email_bounced", label: "Email Bounced" });
        }
        if (has("sms")) {
          add({ value: "sms_delivered", label: "SMS Delivered" });
          add({ value: "sms_link_clicked", label: "SMS Link Clicked" });
          add({ value: "sms_failed", label: "SMS Failed / Undelivered" });
        }
        // Generic outcomes always available
        add({ value: "purchased", label: "Purchased" });
        add({ value: "no_response", label: "No Response" });

        const current = String(node.data.condition || options[0]?.value || "");
        // If current value no longer in options (channel changed), keep showing but allow reset
        const currentInList = options.some((o) => o.value === current);

        return (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
              {upstream ? (
                <>
                  Upstream message:{" "}
                  <span className="font-medium text-foreground">
                    {messageType === "template"
                      ? `WhatsApp Template${msgData.whatsapp_template_name ? ` — ${msgData.whatsapp_template_name}` : ""}`
                      : `Free-form (${channels.join(", ")})`}
                  </span>
                </>
              ) : (
                <>Connect a Message node before this Decision to see channel-specific options.</>
              )}
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={current} onValueChange={(v) => update("condition", v)}>
                <SelectTrigger><SelectValue placeholder="Select a condition" /></SelectTrigger>
                <SelectContent>
                  {!currentInList && current && (
                    <SelectItem value={current}>
                      {current} (not valid for current channel)
                    </SelectItem>
                  )}
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                The branch is taken when this event occurs for the upstream message.
              </p>
            </div>
          </div>
        );
      })()}

      <div className="pt-4 border-t">
        <Button variant="destructive" size="sm" className="w-full" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete Node
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {String(node.type)} node?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the node and all its connections from the canvas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDelete(node.id); onClose(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
