import { useState } from "react";
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
import { Plus, Play, Pause, Trash2, BarChart3, GitBranch, Users, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ENTITY_SCHEMAS, type EntityKey } from "@/lib/listViewSchema";
import { executeListView } from "@/lib/listViewExecutor";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
};

export default function JourneyList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; list_view_id: string }>({ name: "", description: "", list_view_id: "" });
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  const { data: journeys = [], isLoading } = useQuery({
    queryKey: ["journeys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type)")
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
    const lv = listViews.find((v) => v.id === id);
    if (!lv) return;
    try {
      const res = await executeListView(
        { entity_type: lv.entity_type as EntityKey, filters: [] },
        { countOnly: true }
      );
      // Re-execute with stored filters via list_view fetch for accuracy
      const { data: full } = await supabase.from("list_views" as any).select("*").eq("id", id).maybeSingle();
      if (full) {
        const accurate = await executeListView(
          { entity_type: full.entity_type, selected_fields: full.selected_fields, filters: full.filters },
          { countOnly: true }
        );
        setAudienceCount(accurate.count);
      } else {
        setAudienceCount(res.count);
      }
    } catch {
      setAudienceCount(null);
    }
  };

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
              journeys.map((j: any) => (
                <TableRow key={j.id} className="cursor-pointer" onClick={() => navigate(`/communication/journeys/${j.id}`)}>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[j.status] || ""}>{j.status}</Badge>
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
                      {j.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatusMutation.mutate({ id: j.id, status: "active" })}>
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
                emptyText="No list views yet"
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
    </div>
  );
}
