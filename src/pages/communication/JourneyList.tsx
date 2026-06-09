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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Play, Pause, Trash2, BarChart3, GitBranch, Users, MessageSquare, ExternalLink, Send, Inbox, Check, X, Calendar as CalendarIcon, Pencil } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";
import { executeListView } from "@/lib/listViewExecutor";
import { JourneyScheduleDialog } from "@/components/journey/JourneyScheduleDialog";
import { summarizeSchedule, type JourneySchedule } from "@/lib/journeySchedule";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { AudienceBuilder, type AudienceConfig } from "@/components/journey/AudienceBuilder";
import { EditJourneyDetailsDialog } from "@/components/journey/EditJourneyDetailsDialog";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  approved: "border border-green-300 bg-green-50 text-green-800",
};

const STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

const FREQUENCY_FILTER_OPTIONS = [
  { value: "one-time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
  { value: "trigger", label: "Trigger-based" },
];

const CHANNEL_FILTER_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "voice", label: "Voice" },
];

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
  const [form, setForm] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [audienceConfig, setAudienceConfig] = useState<AudienceConfig>({ segments: [], combinator: "union" });

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

  // Schedule dialog state
  const [scheduleJourney, setScheduleJourney] = useState<any | null>(null);

  // Edit journey details dialog
  const [editJourney, setEditJourney] = useState<any | null>(null);

  // List filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [createdByFilter, setCreatedByFilter] = useState<string>("");
  const [listDateFrom, setListDateFrom] = useState<string>("");
  const [listDateTo, setListDateTo] = useState<string>("");

  // Selection + delete confirmation state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; name?: string } | null>(null);

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type, selected_fields, filters), schedule:journey_schedules(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        schedule: Array.isArray(row.schedule) ? (row.schedule[0] || null) : (row.schedule || null),
      }));
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

  // Audience is now driven by the AudienceBuilder component (multi-segment).

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
      const validSegments = (audienceConfig.segments || []).filter((s) => s.list_view_id);
      const hasMulti = validSegments.length > 0;
      const acToSave = hasMulti
        ? { segments: validSegments, combinator: audienceConfig.combinator || "union", primary: audienceConfig.primary }
        : null;
      // Keep list_view_id in sync with the first segment for back-compat with the
      // existing canvas EntryNode badge & legacy reads.
      const firstLvId = validSegments[0]?.list_view_id || null;
      const { data, error } = await supabase
        .from("journeys")
        .insert({
          name: form.name,
          description: form.description,
          list_view_id: firstLvId,
          audience_config: acToSave,
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
      // Close dialog and reset state first so the modal exits smoothly
      setShowCreate(false);
      setForm({ name: "", description: "" });
      setAudienceConfig({ segments: [], combinator: "union" });
      toast.success("Journey created");
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      // Defer navigation so the dialog close animation can run before
      // the heavy JourneyBuilder route mounts and blocks the main thread
      setTimeout(() => navigate(`/communication/journeys/${data.id}`), 0);
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
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("journeys").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      setSelectedIds([]);
      setDeleteTarget(null);
      toast.success(count === 1 ? "Journey deleted" : `${count} journeys deleted`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
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
    // Show Submit for Approval whenever the journey hasn't been approved yet (or was rejected),
    // regardless of run status (draft / active / paused).
    return !a || a === "draft" || a === "rejected";
  };

  // Pending approvals count for current user
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["journey-approvals-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await (supabase as any)
        .from("journeys")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending")
        .eq("approver_id", user.id);
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
      const { data, error } = await (supabase as any)
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type)")
        .eq("approval_status", inboxTab)
        .eq("approver_id", user.id)
        .order("submitted_at", { ascending: false });
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

  // Resolve frequency type for filter from schedule or canvas
  const resolveFrequency = (j: any): string => {
    if (j.schedule?.type === "one_time") return "one-time";
    if (j.schedule?.type === "recurring") return "recurring";
    const canvas = j.canvas_data || {};
    const nodes: any[] = Array.isArray(canvas.nodes) ? canvas.nodes : [];
    const entry = nodes.find((n) => n.type === "entry" || n.data?.type === "entry");
    const ed = entry?.data || {};
    const f = String(ed.frequency || ed.triggerType || ed.trigger_type || "").toLowerCase();
    if (f.includes("trigger") || f.includes("event")) return "trigger";
    if (f.includes("recur")) return "recurring";
    if (f.includes("one")) return "one-time";
    return "";
  };

  const matchesStatusFilter = (j: any, filters: string[]): boolean => {
    if (filters.length === 0) return true;
    const a = j.approval_status;
    return filters.some((f) => {
      switch (f) {
        case "draft": return j.status === "draft" && (!a || a === "draft");
        case "pending": return a === "pending";
        case "approved": return a === "approved" && j.status !== "active";
        case "active": return j.status === "active";
        case "rejected": return a === "rejected";
        default: return false;
      }
    });
  };

  const creatorIds = useMemo(
    () => Array.from(new Set((journeys as any[]).map((j) => j.created_by).filter(Boolean))),
    [journeys]
  );
  const { data: creatorMap = {} } = useQuery({
    queryKey: ["journey-list-creators", creatorIds],
    queryFn: async () => {
      if (creatorIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", creatorIds as string[]);
      if (error) return {};
      const map: Record<string, { username: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { username: p.username, email: p.email }; });
      return map;
    },
    enabled: creatorIds.length > 0,
  });

  const creatorOptions = useMemo(
    () => creatorIds.map((id) => ({
      value: id as string,
      label: (creatorMap as any)[id as string]?.username || (creatorMap as any)[id as string]?.email || "Unknown",
    })),
    [creatorIds, creatorMap]
  );

  const filteredJourneys = useMemo(() => {
    return (journeys as any[]).filter((j) => {
      if (!matchesStatusFilter(j, statusFilter)) return false;
      if (frequencyFilter.length > 0) {
        const f = resolveFrequency(j);
        if (!f || !frequencyFilter.includes(f)) return false;
      }
      if (channelFilter.length > 0) {
        const { channels } = deriveJourneyMeta(j);
        if (!channelFilter.some((c) => channels.includes(c))) return false;
      }
      if (createdByFilter && j.created_by !== createdByFilter) return false;
      if (listDateFrom && new Date(j.created_at) < new Date(listDateFrom)) return false;
      if (listDateTo && new Date(j.created_at) > new Date(listDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [journeys, statusFilter, frequencyFilter, channelFilter, createdByFilter, listDateFrom, listDateTo]);

  const hasActiveFilters =
    statusFilter.length > 0 || frequencyFilter.length > 0 || channelFilter.length > 0 ||
    !!createdByFilter || !!listDateFrom || !!listDateTo;

  const clearListFilters = () => {
    setStatusFilter([]);
    setFrequencyFilter([]);
    setChannelFilter([]);
    setCreatedByFilter("");
    setListDateFrom("");
    setListDateTo("");
  };

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
    <div className="space-y-4 md:space-y-6">
      <BackButton />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">Journey Builder</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Create automated messaging journeys for your audience segments</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="md:h-10 md:px-4" onClick={() => setShowInbox(true)}>
            <Inbox className="mr-2 h-4 w-4" />
            View Approvals{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
          <Button size="sm" className="md:h-10 md:px-4" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Journey
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><GitBranch className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Active Journeys</p>
                <p className="text-xl md:text-2xl font-bold">{stats?.activeJourneys || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><Users className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Enrolled Contacts</p>
                <p className="text-xl md:text-2xl font-bold">{stats?.enrolledContacts || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-xl md:text-2xl font-bold">{stats?.messagesSent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Status</Label>
              <MultiSelectCombobox
                options={STATUS_FILTER_OPTIONS}
                selected={statusFilter}
                onChange={setStatusFilter}
                placeholder="All statuses"
                maxDisplayedBadges={2}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Frequency</Label>
              <MultiSelectCombobox
                options={FREQUENCY_FILTER_OPTIONS}
                selected={frequencyFilter}
                onChange={setFrequencyFilter}
                placeholder="All frequencies"
                maxDisplayedBadges={2}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Channel</Label>
              <MultiSelectCombobox
                options={CHANNEL_FILTER_OPTIONS}
                selected={channelFilter}
                onChange={setChannelFilter}
                placeholder="All channels"
                maxDisplayedBadges={2}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Created By</Label>
              <SearchableSelect
                options={creatorOptions}
                value={createdByFilter}
                onValueChange={(v) => setCreatedByFilter(v === "none" ? "" : v)}
                placeholder="Anyone"
                searchPlaceholder="Search creator..."
                allowNone
                noneLabel="Anyone"
              />
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Created From</Label>
              <Input type="date" value={listDateFrom} onChange={(e) => setListDateFrom(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Created To</Label>
              <Input type="date" value={listDateTo} onChange={(e) => setListDateTo(e.target.value)} />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearListFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredJourneys.length} of {journeys.length} journeys
            </p>
          )}
        </div>
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
            ) : filteredJourneys.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No journeys match the selected filters.</TableCell></TableRow>
            ) : (
              filteredJourneys.map((j: any) => {
                const a = j.approval_status;
                const showApprovalBadge = a && a !== "draft";
                return (
                  <TableRow
                    key={j.id}
                    className={cn("cursor-pointer", j.status === "active" && "bg-green-50 hover:bg-green-100")}
                    onClick={() => navigate(`/communication/journeys/${j.id}`)}
                  >
                    <TableCell className="font-medium py-2 md:py-4 text-xs md:text-sm leading-tight">{j.name}</TableCell>
                    <TableCell className="py-2 md:py-4 align-middle">
                      <div className="flex items-center gap-1 flex-nowrap md:flex-wrap whitespace-nowrap">
                        <Badge className={cn(statusColors[j.status] || "", "text-[10px] md:text-xs px-1.5 py-0 leading-tight")}>{j.status}</Badge>
                        {showApprovalBadge && (
                          <Badge className={cn(approvalBadgeClass[a] || "", "text-[10px] md:text-xs px-1.5 py-0 leading-tight")}>{approvalLabel[a] || a}</Badge>
                        )}
                        {j.schedule && (
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0 leading-tight max-w-[110px] md:max-w-none truncate" title={summarizeSchedule(j.schedule as JourneySchedule)}>
                            <CalendarIcon className="h-3 w-3 mr-1 shrink-0" />
                            <span className="truncate">{summarizeSchedule(j.schedule as JourneySchedule)}</span>
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 md:py-4 text-xs md:text-sm">
                      {j.list_view ? (
                        <span className="line-clamp-2 md:line-clamp-none">{j.list_view.name} <Badge variant="outline" className="ml-1 capitalize text-[10px] md:text-xs px-1 py-0">{ENTITY_SCHEMAS[j.list_view.entity_type as EntityKey]?.label || j.list_view.entity_type}</Badge></span>
                      ) : j.segment_type ? (
                        <span className="capitalize line-clamp-2 md:line-clamp-none">{j.segment_type} <Badge variant="outline" className="ml-1 text-[10px] md:text-xs px-1 py-0">legacy</Badge></span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="py-2 md:py-4 text-xs md:text-sm whitespace-nowrap">
                      <span className="md:hidden">{format(new Date(j.created_at), "MMM d")}</span>
                      <span className="hidden md:inline">{format(new Date(j.created_at), "MMM d, yyyy")}</span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canSubmit(j) && (
                          <Button size="sm" variant="ghost" title="Submit for Approval" onClick={() => openSubmitDialog(j)}>
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {(j.status === "draft" || j.status === "active" || j.status === "paused") && (
                          <Button size="sm" variant="ghost" title="Edit Journey" onClick={() => setEditJourney(j)}>
                            <Pencil className="h-4 w-4" />
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
                        <Button size="sm" variant="ghost" title="Schedule" onClick={() => setScheduleJourney(j)}>
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
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
            <AudienceBuilder value={audienceConfig} onChange={setAudienceConfig} />
            <a href="/list-views" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
              Manage list views <ExternalLink className="h-3 w-3" />
            </a>
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

      {/* Approvals Inbox Dialog */}
      <Dialog open={showInbox} onOpenChange={setShowInbox}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Journey Approvals</DialogTitle></DialogHeader>
          <Tabs value={inboxTab} onValueChange={(v) => setInboxTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mt-4 mb-2">
              <div>
                <Label className="text-xs">Channel</Label>
                <select
                  className="block h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                >
                  <option value="all">All</option>
                  {allChannels.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9 w-40" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9 w-40" />
              </div>
              {(filterChannel !== "all" || filterFrom || filterTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterChannel("all"); setFilterFrom(""); setFilterTo(""); }}>
                  Clear
                </Button>
              )}
            </div>

            {(["pending", "approved", "rejected"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Journey</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Audience</TableHead>
                      {tab === "rejected" && <TableHead>Reason</TableHead>}
                      {tab === "pending" && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInbox.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tab === "pending" || tab === "rejected" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                          {inboxJourneys.length === 0 ? "No approvals assigned" : "No items match the filters"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInbox.map((j: any) => {
                        const meta = deriveJourneyMeta(j);
                        return (
                          <TableRow key={j.id}>
                            <TableCell className="font-medium">{j.name}</TableCell>
                            <TableCell>{(submitterMap as Record<string, string>)[j.created_by] || "—"}</TableCell>
                            <TableCell>{j.submitted_at ? format(new Date(j.submitted_at), "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell className="text-sm">{meta.schedule}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {meta.channels.length === 0 ? "—" : meta.channels.map((c) => (
                                  <Badge key={c} variant="outline" className="capitalize">{c}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{j.list_view?.name || "—"}</TableCell>
                            {tab === "rejected" && (
                              <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={j.rejection_reason || ""}>
                                {j.rejection_reason || "—"}
                              </TableCell>
                            )}
                            {tab === "pending" && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Approve"
                                    onClick={() => approveMutation.mutate(j.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Reject"
                                    className="text-destructive"
                                    onClick={() => { setRejectTarget(j); setRejectReason(""); }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Journey</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejecting <span className="font-medium text-foreground">{rejectTarget?.name}</span>.
            </p>
            <div>
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Incorrect audience filter"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Schedule Dialog */}
      {scheduleJourney && (
        <JourneyScheduleDialog
          open={!!scheduleJourney}
          onOpenChange={(o) => { if (!o) setScheduleJourney(null); }}
          journeyId={scheduleJourney.id}
          journeyName={scheduleJourney.name}
          existing={scheduleJourney.schedule || null}
        />
      )}
      <EditJourneyDetailsDialog
        open={!!editJourney}
        onOpenChange={(o) => { if (!o) setEditJourney(null); }}
        journey={editJourney}
      />
    </div>
  );
}
