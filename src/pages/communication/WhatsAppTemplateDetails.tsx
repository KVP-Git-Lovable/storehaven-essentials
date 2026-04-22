import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Send, AlertTriangle, Copy, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { parseStoredBody, transformTwilioToFriendly } from "@/lib/whatsappVariables";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-destructive/10 text-destructive",
};

export default function WhatsAppTemplateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [toNumber, setToNumber] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [mediaCheck, setMediaCheck] = useState<{ ok: boolean; status: number; content_type?: string | null; content_length?: number | null; error?: string } | null>(null);
  const [mediaChecking, setMediaChecking] = useState(false);

  const verifyMediaUrl = async (url: string) => {
    if (!url.trim()) {
      toast.error("Enter a media URL first");
      return;
    }
    setMediaChecking(true);
    setMediaCheck(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: "verify-media-url", url: url.trim() }),
        }
      );
      const data = await response.json();
      setMediaCheck(data);
      if (data.ok) toast.success(`Reachable · ${data.status} ${data.content_type ?? ""}`.trim());
      else toast.error(data.error || `Unreachable (HTTP ${data.status})`);
    } catch (e: any) {
      setMediaCheck({ ok: false, status: 0, error: e?.message || "Request failed" });
      toast.error(e?.message || "Request failed");
    } finally {
      setMediaChecking(false);
    }
  };

  const { data: template, isLoading } = useQuery({
    queryKey: ["whatsapp-template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ template_id: id, action: "refresh-status" }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to refresh status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-template", id] });
      toast.success("Status refreshed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            template_id: id,
            to_number: toNumber,
            from_number: fromNumber,
            variables,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowSendDialog(false);
      toast.success("Test message sent!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!template) {
    return <div className="text-center py-12 text-muted-foreground">Template not found</div>;
  }

  // Parse stored body — extract clean Twilio body and friendly mapping (if present)
  const { twilioBody: cleanBody, mapping } = parseStoredBody(template.body);

  // Extract numeric variables from the clean body
  const bodyVars = cleanBody.match(/\{\{(\d+)\}\}/g) || [];
  const varNumbers = Array.from(new Set(bodyVars.map((v: string) => v.replace(/[{}]/g, ""))));

  // Display body — friendly names if mapping exists, otherwise numeric
  const displayBody = mapping ? transformTwilioToFriendly(cleanBody, mapping) : cleanBody;

  // Highlight variables in display body
  const highlightedBody = displayBody.replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    '<span class="bg-primary/20 text-primary px-1 rounded font-mono">{{$1}}</span>'
  );

  // Helper: friendly name for a numeric var (or fallback to number)
  const labelFor = (num: string) => mapping?.[num] || num;

  // Synced Twilio Content metadata (populated by bulk-sync / refresh-status)
  const twilioType: string | null = (template as any).twilio_template_type ?? null;
  const twilioMediaUrl: string | null = (template as any).twilio_media_url ?? null;
  const twilioMediaIsVar: boolean = !!(template as any).twilio_media_is_variable;
  const twilioRequired: string[] = Array.isArray((template as any).twilio_required_variables)
    ? (template as any).twilio_required_variables
    : [];
  const twilioSyncedAt: string | null = (template as any).twilio_synced_at ?? null;

  // Prefill the media URL tester with the actual synced URL when it is static
  if (mediaUrlInput === "" && twilioMediaUrl && !twilioMediaIsVar) {
    // Set asynchronously to avoid setState-during-render
    queueMicrotask(() => setMediaUrlInput(twilioMediaUrl));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/communication/templates")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-muted-foreground">Template details</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
          {template.status === "approved" && (
            <Button onClick={() => setShowSendDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send Test Message
            </Button>
          )}
        </div>
      </div>

      {template.status === "rejected" && template.rejection_reason && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Template Rejected</AlertTitle>
          <AlertDescription>{template.rejection_reason}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Template Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={statusColors[template.status]}>{template.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <Badge variant="outline">{template.category}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span>{template.language}</span>
            </div>
            {template.twilio_content_sid && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Content SID</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{template.twilio_content_sid}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      navigator.clipboard.writeText(template.twilio_content_sid!);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-sm">{format(new Date(template.created_at), "MMM d, yyyy HH:mm")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span className="text-sm">{format(new Date(template.updated_at), "MMM d, yyyy HH:mm")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedBody }}
            />
            {varNumbers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  Variables: {varNumbers.map((v: string) => `{{${labelFor(v)}}}`).join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Media URL Reachability Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Verify that any media URL referenced by this template is publicly downloadable by Twilio/Meta. A 403 here is the most common cause of media-template delivery failures.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://your-domain.com/path/image.jpg"
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
            />
            <Button onClick={() => verifyMediaUrl(mediaUrlInput)} disabled={mediaChecking}>
              {mediaChecking ? "Testing..." : "Test media URL"}
            </Button>
          </div>
          {mediaCheck && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                mediaCheck.ok
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}
            >
              {mediaCheck.ok ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
              <div className="space-y-0.5">
                <p className="font-medium">
                  {mediaCheck.ok ? "Reachable" : "Unreachable"} · HTTP {mediaCheck.status}
                </p>
                {mediaCheck.content_type && (
                  <p className="text-xs opacity-90">Content-Type: {mediaCheck.content_type}</p>
                )}
                {typeof mediaCheck.content_length === "number" && (
                  <p className="text-xs opacity-90">
                    Size: {(mediaCheck.content_length / 1024).toFixed(1)} KB
                  </p>
                )}
                {mediaCheck.error && <p className="text-xs opacity-90">{mediaCheck.error}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Test Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>From Number (E.164)</Label>
              <Input placeholder="+14155238886" value={fromNumber} onChange={(e) => setFromNumber(e.target.value)} />
            </div>
            <div>
              <Label>To Number (E.164)</Label>
              <Input placeholder="+919876543210" value={toNumber} onChange={(e) => setToNumber(e.target.value)} />
            </div>
            {varNumbers.map((v: string) => (
              <div key={v}>
                <Label>{mapping?.[v] ? mapping[v] : `Variable {{${v}}}`}</Label>
                <Input
                  placeholder={`Value for ${mapping?.[v] ? `{{${mapping[v]}}}` : `{{${v}}}`}`}
                  value={variables[v] || ""}
                  onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!toNumber || !fromNumber || sendMutation.isPending}
            >
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
