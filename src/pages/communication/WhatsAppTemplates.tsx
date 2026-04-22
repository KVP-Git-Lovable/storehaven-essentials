import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, RefreshCw, Eye, Trash2, MessageSquare, Download, ChevronDown, Info, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/shared/BackButton";
import { format } from "date-fns";
import {
  VARIABLE_GROUPS,
  buildStoredBody,
  transformFriendlyToTwilio,
  validateFriendlyBody,
} from "@/lib/whatsappVariables";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  twilio_content_sid: string | null;
  status: string;
  rejection_reason: string | null;
  user_initiated_approved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-destructive/10 text-destructive",
};

export default function WhatsAppTemplates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [form, setForm] = useState({ name: "", category: "UTILITY", language: "en", body: "" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (templateData: typeof form) => {
      const { data: { session } } = await supabase.auth.getSession();
      // Convert friendly body -> stored body (numeric + hidden mapping marker)
      const { storedBody } = buildStoredBody(templateData.body);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            name: templateData.name,
            category: templateData.category,
            language: templateData.language,
            body: storedBody,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setShowCreateDialog(false);
      setForm({ name: "", category: "UTILITY", language: "en", body: "" });
      toast.success("Template created successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkSyncMutation = useMutation({
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
          body: JSON.stringify({ action: "bulk-sync" }),
        }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Statuses synced");
    },
  });

  const importMutation = useMutation({
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
          body: JSON.stringify({ action: "import-from-twilio" }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success(`Imported ${data.imported} templates, ${data.skipped} already existed`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredTemplates = templates.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    return true;
  });

  const insertVariableAtCursor = (varName: string) => {
    const placeholder = `{{${varName}}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setForm((f) => ({ ...f, body: f.body + placeholder }));
      return;
    }
    const start = ta.selectionStart ?? form.body.length;
    const end = ta.selectionEnd ?? form.body.length;
    const newBody = form.body.slice(0, start) + placeholder + form.body.slice(end);
    setForm({ ...form, body: newBody });
    // Restore cursor after React update
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + placeholder.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const validation = validateFriendlyBody(form.body);
  const { twilioBody } = transformFriendlyToTwilio(form.body);

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
          <p className="text-muted-foreground">Create and manage WhatsApp message templates via Twilio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            <Download className={`h-4 w-4 mr-2 ${importMutation.isPending ? "animate-spin" : ""}`} />
            Import from Twilio
          </Button>
          <Button variant="outline" onClick={() => bulkSyncMutation.mutate()} disabled={bulkSyncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${bulkSyncMutation.isPending ? "animate-spin" : ""}`} />
            Sync All
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No templates found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge className={statusColors[template.status]}>{template.status}</Badge>
                        {template.user_initiated_approved && template.status !== "approved" && (
                          <Badge variant="outline" className="text-xs">User-initiated</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(template.updated_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/communication/templates/${template.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this template?")) {
                              deleteMutation.mutate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create WhatsApp Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. order_confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              />
              <p className="text-xs text-muted-foreground mt-1">Lowercase with underscores only</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Message Body</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            <Plus className="h-3 w-3 mr-1" />
                            Insert Variable
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto bg-popover">
                          {Object.entries(VARIABLE_GROUPS).map(([group, vars], idx) => (
                            <div key={group}>
                              {idx > 0 && <DropdownMenuSeparator />}
                              <DropdownMenuLabel className="text-xs text-muted-foreground">{group}</DropdownMenuLabel>
                              <DropdownMenuGroup>
                                {vars.map((v) => (
                                  <DropdownMenuItem key={v} onClick={() => insertVariableAtCursor(v)}>
                                    <code className="text-xs">{`{{${v}}}`}</code>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">Variables are automatically mapped to WhatsApp format on submission</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                ref={textareaRef}
                rows={5}
                placeholder="Hello {{customer_name}}, your order {{order_id}} has been confirmed."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Click "Insert Variable" to add named variables — they get auto-mapped to {"{{1}}, {{2}}"} for Twilio.
              </p>

              {validation.warnings.length > 0 && (
                <div className="mt-2 rounded-md bg-destructive/10 p-2 space-y-1">
                  {validation.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {validation.variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Detected:</span>
                  {validation.variables.map((v, i) => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {`{{${v}}}`} → {`{{${i + 1}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {form.body && (
              <div>
                <Label className="text-sm">Preview</Label>
                <Tabs defaultValue="friendly" className="mt-1">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="friendly" className="text-xs">Friendly view</TabsTrigger>
                    <TabsTrigger value="twilio" className="text-xs">Twilio format</TabsTrigger>
                  </TabsList>
                  <TabsContent value="friendly">
                    <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed border">
                      {form.body || <span className="text-muted-foreground">Empty</span>}
                    </div>
                  </TabsContent>
                  <TabsContent value="twilio">
                    <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed border font-mono">
                      {twilioBody || <span className="text-muted-foreground">Empty</span>}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.body || !validation.valid || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
