import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Node } from "@xyflow/react";
import { parseStoredBody, transformTwilioToFriendly } from "@/lib/whatsappVariables";

interface Props {
  node: Node;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
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

const CONTACT_FIELD_SUGGESTIONS: { label: string; token: string }[] = [
  { label: "Contact name", token: "{{contact.name}}" },
  { label: "First name", token: "{{contact.first_name}}" },
  { label: "Phone", token: "{{contact.phone}}" },
  { label: "Email", token: "{{contact.email}}" },
  { label: "City", token: "{{contact.city}}" },
];

export function NodePropertyPanel({ node, onUpdate, onDelete, onClose }: Props) {
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

  const whatsappTemplateBody = useMemo(() => {
    if (!selectedWhatsAppTemplate) return "";
    const { twilioBody, mapping } = parseStoredBody(selectedWhatsAppTemplate.body);
    return mapping ? transformTwilioToFriendly(twilioBody, mapping) : twilioBody;
  }, [selectedWhatsAppTemplate]);

  const whatsappVariables = useMemo(() => {
    const matches = whatsappTemplateBody.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
    return Array.from(new Set(Array.from(matches, (match) => match[1])));
  }, [whatsappTemplateBody]);

  const updateWhatsAppVariable = (name: string, value: string) => {
    const existing = (node.data.template_variables as Record<string, string> | undefined) ?? {};
    onUpdate(node.id, {
      ...node.data,
      template_variables: {
        ...existing,
        [name]: value,
      },
    });
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

    const { twilioBody, mapping } = parseStoredBody(firstTemplate.body);
    const displayBody = mapping ? transformTwilioToFriendly(twilioBody, mapping) : twilioBody;
    const initialVariables = Object.fromEntries(
      Array.from(displayBody.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g), (match) => [match[1], `{{${match[1]}}}`])
    );

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

    const { twilioBody, mapping } = parseStoredBody(template.body);
    const displayBody = mapping ? transformTwilioToFriendly(twilioBody, mapping) : twilioBody;
    const initialVariables = Object.fromEntries(
      Array.from(displayBody.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g), (match) => [match[1], `{{${match[1]}}}`])
    );

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
        <h3 className="font-semibold text-sm capitalize">{String(node.type)} Properties</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {node.type === "entry" && (
        node.data.list_view_id ? (
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

      {node.type === "message" && (
        <>
          <div><Label>Channel</Label>
            <Select value={String(node.data.channel || "email")} onValueChange={handleChannelChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push Notification</SelectItem>
                <SelectItem value="whatsapp_template">WhatsApp Template</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {node.data.channel === "whatsapp_template" ? (
            <>
              <div className="space-y-2">
                <Label>Approved Template</Label>
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
                    <p className="text-xs text-muted-foreground mt-1">Map each placeholder to a contact field token or fixed value.</p>
                  </div>
                  {whatsappVariables.map((variable) => (
                    <div key={variable} className="space-y-1">
                      <Label className="text-xs">{`{{${variable}}}`}</Label>
                      <Input
                        value={String(node.data.template_variables?.[variable] || `{{${variable}}}`)}
                        onChange={(e) => updateWhatsAppVariable(variable, e.target.value)}
                        placeholder={`{{${variable}}}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div><Label>Message Body</Label>
              <Textarea value={String(node.data.template_body || "")} onChange={(e) => update("template_body", e.target.value)} placeholder="Use {name}, {last_purchase_date}..." rows={4} />
            </div>
          )}
        </>
      )}

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

      {node.type === "decision" && (
        <div><Label>Condition</Label>
          <Select value={String(node.data.condition || "opened")} onValueChange={(v) => update("condition", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opened">Email Opened</SelectItem>
              <SelectItem value="clicked">Link Clicked</SelectItem>
              <SelectItem value="purchased">Purchased</SelectItem>
            </SelectContent>
         </Select>
        </div>
      )}

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
