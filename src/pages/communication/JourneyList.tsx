import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Play, Pause, Trash2, BarChart3, GitBranch, Users, MessageSquare, ExternalLink, Send, Inbox, Check, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";
import { executeListView } from "@/lib/listViewExecutor";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
};

const approvalBadgeClass: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const approvalLabel: Record<string, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default function JourneyList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; list_view_id: string }>({ name: "", description: "", list_view_id: "" });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  // Submit-for-approval modal state
  const [submitJourney, setSubmitJourney] = useState<any | null>(null);
  const [approverId, setApproverId] = useState<string>("");
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [submitAudienceCount, setSubmitAudienceCount] = useState<number | null>(null);

  // Approvals inbox state
  const [showInbox, setShowInbox] = useState(false);
  const [inboxTab, setInboxTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type, selected_fields, filters)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: listViews = [] } = useQuery({
    queryKey: ["list-views-for-journey"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_views" as any)
        .select("id, name, entity_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Approver-eligible profiles: managers and above
  const { data: approvers = [] } = useQuery({
    queryKey: ["approver-eligible-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, role:role_id(id, name)")
        .order("username", { ascending: true });
      if (error) throw error;
      const managerRoles = ["store manager", "super admin", "admin", "manager"];
      return (data || []).filter((p: any) => {
        const roleName = (p.role?.name || "").toLowerCase();
        return managerRoles.some((r) => roleName.includes(r));
      });
    },
  });

  // Created-by lookup for the journey being submitted
  const { data: createdByProfile } = useQuery({
    queryKey: ["journey-created-by", submitJourney?.created_by],
    queryFn: async () => {
      if (!submitJourney?.created_by) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", submitJourney.created_by)
        .maybeSingle();
      if (error) return null;
      return data as { id: string; username: string | null } | null;
    },
    enabled: !!submitJourney?.created_by,
  });

  const { data: stats } = useQuery({
    queryKey: ["journey-stats"],
    queryFn: async () => {
      const [enrollments, messages] = await Promise.all([
        supabase.from("journey_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("journey_message_log").select("id", { count: "exact", head: true }),
      ]);
      return {
        activeJourneys: journeys.filter((j: any) => j.status === "active").length,
        enrolledContacts: enrollments.count || 0,
        messagesSent: messages.count || 0,
      };
    },
    enabled: journeys.length >= 0,
  });

  const handleListViewChange = async (id: string) => {
    setForm({ ...form, list_view_id: id });
    setAudienceCount(null);
    if (!id) return;
    try {
      const { data: full } = await supabase.from("list_views" as any).select("*").eq("id", id).maybeSingle();
      const lv = full as any;
      if (!lv) return;
      const result = await executeListView(
        { entity_type: lv.entity_type, selected_fields: lv.selected_fields, filters: lv.filters },
        { countOnly: true }
      );
      setAudienceCount(result.count);
    } catch {
      setAudienceCount(null);
    }
  };

  const openSubmitDialog = async (journey: any) => {
    setSubmitJourney(journey);
    setApproverId("");
    setApprovalNotes("");
    setSubmitAudienceCount(null);
    if (journey.list_view) {
      try {
        const result = await executeListView(
          {
            entity_type: journey.list_view.entity_type,
            selected_fields: journey.list_view.selected_fields,
            filters: journey.list_view.filters,
          },
          { countOnly: true }
        );
        setSubmitAudienceCount(result.count);
      } catch {
        setSubmitAudienceCount(null);
      }
    }
  };

  // Derive schedule/channels from canvas_data
  const submitDerived = useMemo(() => {
    if (!submitJourney) return { startDate: null, endDate: null, frequency: null, channels: [] as { channel: string; templateName?: string }[] };
    const canvas = submitJourney.canvas_data || {};
    const nodes: any[] = Array.isArray(canvas.nodes) ? canvas.nodes : [];
    const entry = nodes.find((n) => n.type === "entry" || n.data?.type === "entry");
    const entryData = entry?.data || {};
    const messageNodes = nodes.filter((n) => n.type === "message" || n.data?.type === "message");
    const channels = messageNodes.map((n) => {
      const d = n.data || {};
      return {
        channel: d.channel || d.messageChannel || "—",
        templateName: d.templateName || d.template_name || d.template?.name,
      };
    });
    return {
      startDate: entryData.startDate || entryData.start_date || null,
      endDate: entryData.endDate || entryData.end_date || null,
      frequency: entryData.frequency || entryData.triggerType || entryData.trigger_type || null,
      channels,
    };
  }, [submitJourney]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .insert({
          name: form.name,
          description: form.description,
          list_view_id: form.list_view_id || null,
          segment_type: null,
          canvas_data: { nodes: [], edges: [] },
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Journey created");
      setShowCreate(false);
      setForm({ name: "", description: "", list_view_id: "" });
      setAudienceCount(null);
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      navigate(`/communication/journeys/${data.id}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create journey"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("journeys").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Journey status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journeys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      toast.success("Journey deleted");
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async () => {
      if (!submitJourney) throw new Error("No journey selected");
      if (!approverId) throw new Error("Please select an approver");
      const { error } = await supabase
        .from("journeys")
        .update({
          approval_status: "pending",
          approver_id: approverId,
          submitted_at: new Date().toISOString(),
          approval_notes: approvalNotes || null,
          rejection_reason: null,
        } as any)
        .eq("id", submitJourney.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted for approval");
      setSubmitJourney(null);
      setApproverId("");
      setApprovalNotes("");
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit for approval"),
  });

  const canSubmit = (j: any) => {
    const a = j.approval_status;
    return j.status === "draft" && (!a || a === "draft" || a === "rejected");
  };

  // Pending approvals count for current user
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["journey-approvals-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("journeys")
        .select("id", { count: "exact", head: true })
        .eq("approval_status" as any, "pending")
        .eq("approver_id" as any, user.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Inbox journeys (pending/approved/rejected) assigned to current user
  const { data: inboxJourneys = [] } = useQuery({
    queryKey: ["journey-approvals-inbox", user?.id, inboxTab],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type)")
        .eq("approval_status" as any, inboxTab)
        .eq("approver_id" as any, user.id)
        .order("submitted_at" as any, { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && showInbox,
  });

  // Submitter username lookup for inbox rows
  const submitterIds = useMemo(
    () => Array.from(new Set((inboxJourneys as any[]).map((j) => j.created_by).filter(Boolean))),
    [inboxJourneys]
  );
  const { data: submitterMap = {} } = useQuery({
    queryKey: ["journey-inbox-submitters", submitterIds],
    queryFn: async () => {
      if (submitterIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", submitterIds as string[]);
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.username || ""; });
      return map;
    },
    enabled: submitterIds.length > 0,
  });

  const deriveJourneyMeta = (j: any) => {
    const canvas = j.canvas_data || {};
    const nodes: any[] = Array.isArray(canvas.nodes) ? canvas.nodes : [];
    const entry = nodes.find((n) => n.type === "entry" || n.data?.type === "entry");
    const ed = entry?.data || {};
    const messageNodes = nodes.filter((n) => n.type === "message" || n.data?.type === "message");
    const channels = Array.from(new Set(messageNodes.map((n) => (n.data?.channel || n.data?.messageChannel || "").toLowerCase()).filter(Boolean)));
    return {
      schedule: [
        ed.frequency || ed.triggerType || ed.trigger_type,
        ed.startDate || ed.start_date ? `from ${format(new Date(ed.startDate || ed.start_date), "MMM d")}` : null,
      ].filter(Boolean).join(" · ") || "—",
      channels,
    };
  };

  const filteredInbox = useMemo(() => {
    return (inboxJourneys as any[]).filter((j) => {
      const { channels } = deriveJourneyMeta(j);
      if (filterChannel !== "all" && !channels.includes(filterChannel)) return false;
      if (filterFrom && j.submitted_at && new Date(j.submitted_at) < new Date(filterFrom)) return false;
      if (filterTo && j.submitted_at && new Date(j.submitted_at) > new Date(filterTo + "T23:59:59")) return false;
      return true;
    });
  }, [inboxJourneys, filterChannel, filterFrom, filterTo]);

  const allChannels = useMemo(() => {
    const set = new Set<string>();
    (inboxJourneys as any[]).forEach((j) => deriveJourneyMeta(j).channels.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [inboxJourneys]);

  const invalidateApprovalQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["journeys"] });
    queryClient.invalidateQueries({ queryKey: ["journey-approvals-inbox"] });
    queryClient.invalidateQueries({ queryKey: ["journey-approvals-count"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journeys")
        .update({ approval_status: "approved", approved_at: new Date().toISOString(), rejection_reason: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Journey approved"); invalidateApprovalQueries(); },
    onError: (e: any) => toast.error(e.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) throw new Error("No journey selected");
      if (!rejectReason.trim()) throw new Error("Rejection reason is required");
      const { error } = await supabase
        .from("journeys")
        .update({ approval_status: "rejected", rejection_reason: rejectReason } as any)
        .eq("id", rejectTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Journey rejected");
      setRejectTarget(null);
      setRejectReason("");
      invalidateApprovalQueries();
    },
    onError: (e: any) => toast.error(e.message || "Failed to reject"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journey Builder</h1>
          <p className="text-muted-foreground">Create automated messaging journeys for your audience segments</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Journey
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><GitBranch className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active Journeys</p>
                <p className="text-2xl font-bold">{stats?.activeJourneys || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><Users className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Enrolled Contacts</p>
                <p className="text-2xl font-bold">{stats?.enrolledContacts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold">{stats?.messagesSent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : journeys.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No journeys yet. Create one to get started.</TableCell></TableRow>
            ) : (
              journeys.map((j: any) => {
                const a = j.approval_status;
                const showApprovalBadge = a && a !== "draft";
                return (
                  <TableRow key={j.id} className="cursor-pointer" onClick={() => navigate(`/communication/journeys/${j.id}`)}>
                    <TableCell className="font-medium">{j.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge className={statusColors[j.status] || ""}>{j.status}</Badge>
                        {showApprovalBadge && (
                          <Badge className={approvalBadgeClass[a] || ""}>{approvalLabel[a] || a}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {j.list_view ? (
                        <span>{j.list_view.name} <Badge variant="outline" className="ml-1 capitalize">{ENTITY_SCHEMAS[j.list_view.entity_type as EntityKey]?.label || j.list_view.entity_type}</Badge></span>
                      ) : j.segment_type ? (
                        <span className="capitalize">{j.segment_type} <Badge variant="outline" className="ml-1">legacy</Badge></span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{format(new Date(j.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canSubmit(j) && (
                          <Button size="sm" variant="ghost" title="Submit for Approval" onClick={() => openSubmitDialog(j)}>
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {j.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={a === "pending" ? "Awaiting approval" : "Activate"}
                            disabled={a === "pending"}
                            onClick={() => updateStatusMutation.mutate({ id: j.id, status: "active" })}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {j.status === "active" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatusMutation.mutate({ id: j.id, status: "paused" })}>
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {j.status === "paused" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatusMutation.mutate({ id: j.id, status: "active" })}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/communication/journeys/${j.id}/analytics`)}>
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(j.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Journey Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Journey</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Welcome Series" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the journey purpose..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Target Segment (List View)</Label>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => window.open("/list-views/new", "_blank")}>
                  <Plus className="h-3 w-3 mr-1" /> Create New List View
                </Button>
              </div>
              <SearchableSelect
                value={form.list_view_id}
                onValueChange={handleListViewChange}
                options={listViews.map((v) => ({
                  value: v.id,
                  label: `${v.name} (${ENTITY_SCHEMAS[v.entity_type as EntityKey]?.label || v.entity_type})`,
                }))}
                placeholder="Select a list view..."
                searchPlaceholder="Search list views..."
                emptyMessage="No list views yet"
              />
              <p className="text-xs text-muted-foreground mt-1">Select a pre-configured list view to define your target audience.</p>
              {audienceCount !== null && form.list_view_id && (
                <Badge variant="secondary" className="mt-2">Estimated audience: {audienceCount}</Badge>
              )}
              <a href="/list-views" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-2">
                Manage list views <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Approval Dialog */}
      <Dialog open={!!submitJourney} onOpenChange={(open) => !open && setSubmitJourney(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Submit for Approval</DialogTitle></DialogHeader>
          {submitJourney && (
            <div className="space-y-5 px-1">
              {/* A. Journey Summary */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Journey Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium">{submitJourney.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge className={statusColors[submitJourney.status] || ""}>{submitJourney.status}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Created By</p>
                    <p className="font-medium">{createdByProfile?.username || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Last Updated</p>
                    <p className="font-medium">{submitJourney.updated_at ? format(new Date(submitJourney.updated_at), "MMM d, yyyy h:mm a") : "—"}</p>
                  </div>
                </div>
              </section>

              {/* B. Schedule */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Schedule Details</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Start Date</p>
                    <p className="font-medium">{submitDerived.startDate ? format(new Date(submitDerived.startDate), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">End Date</p>
                    <p className="font-medium">{submitDerived.endDate ? format(new Date(submitDerived.endDate), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Frequency</p>
                    <p className="font-medium capitalize">{submitDerived.frequency || "—"}</p>
                  </div>
                </div>
              </section>

              {/* C. Channels */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Channel Summary</h3>
                {submitDerived.channels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No message nodes configured yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {submitDerived.channels.map((c, i) => (
                      <Badge key={i} variant="outline" className="capitalize">
                        {c.channel}{c.templateName ? ` · ${c.templateName}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              {/* D. Audience */}
              <section>
                <h3 className="text-sm font-semibold mb-2">Audience Summary</h3>
                {submitJourney.list_view ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{submitJourney.list_view.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {ENTITY_SCHEMAS[submitJourney.list_view.entity_type as EntityKey]?.label || submitJourney.list_view.entity_type}
                    </Badge>
                    {submitAudienceCount !== null && (
                      <Badge variant="secondary">Est. {submitAudienceCount} contacts</Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No list view linked.</p>
                )}
              </section>

              {/* E. Approver */}
              <section>
                <Label>Select Approver <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  value={approverId}
                  onValueChange={setApproverId}
                  options={approvers.map((p: any) => ({
                    value: p.id,
                    label: p.username || p.email || "Unnamed",
                    subtitle: p.role?.name || undefined,
                  }))}
                  placeholder="Select an approver..."
                  searchPlaceholder="Search managers..."
                  emptyMessage="No eligible approvers found"
                />
                <p className="text-xs text-muted-foreground mt-1">Showing manager-level users (Store Manager, Admin, Super Admin).</p>
              </section>

              {/* F. Notes */}
              <section>
                <Label>Notes for Approver (optional)</Label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add context for the approver..."
                  rows={3}
                />
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitJourney(null)}>Cancel</Button>
            <Button
              onClick={() => submitForApprovalMutation.mutate()}
              disabled={!approverId || submitForApprovalMutation.isPending}
            >
              {submitForApprovalMutation.isPending ? "Submitting..." : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
