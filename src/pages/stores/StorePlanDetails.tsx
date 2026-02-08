import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Plus, Trash2, Upload, FileImage, FileVideo, Download,
  MapPin, Building2, Send, CheckCircle2, XCircle, Clock,
} from "lucide-react";

export default function StorePlanDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [showPotentialStoreForm, setShowPotentialStoreForm] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showLinkFranchiseeForm, setShowLinkFranchiseeForm] = useState(false);
  const [showLinkNSOForm, setShowLinkNSOForm] = useState(false);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [selectedFranchiseeId, setSelectedFranchiseeId] = useState("");
  const [selectedNSOId, setSelectedNSOId] = useState("");
  const [potentialForm, setPotentialForm] = useState({
    name: "", address: "", city: "", state: "", pin_code: "",
    size_sqft: "", status: "prospective", advantages: "", disadvantages: "",
    budget_asked: "", available_from: "", contact_person: "", contact_phone: "", notes: "",
  });
  const [approvalForm, setApprovalForm] = useState({
    approver_role: "", approver_user_id: "", level_order: 1,
  });

  const { data: plan, isLoading } = useQuery({
    queryKey: ["store-plan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: potentialStores = [] } = useQuery({
    queryKey: ["potential-stores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("potential_stores").select("*").eq("store_plan_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: approvalLevels = [] } = useQuery({
    queryKey: ["store-plan-approvals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plan_approval_levels").select("*").eq("store_plan_id", id!).order("level_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: attachmentsMap = {} } = useQuery({
    queryKey: ["potential-store-attachments", id],
    queryFn: async () => {
      const storeIds = potentialStores.map((s) => s.id);
      if (storeIds.length === 0) return {};
      const { data, error } = await supabase
        .from("potential_store_attachments").select("*").in("potential_store_id", storeIds);
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data.forEach((a) => {
        if (!map[a.potential_store_id]) map[a.potential_store_id] = [];
        map[a.potential_store_id].push(a);
      });
      return map;
    },
    enabled: potentialStores.length > 0,
  });

  // Linked Franchisees
  const { data: linkedFranchisees = [] } = useQuery({
    queryKey: ["linked-franchisees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisees").select("*").eq("store_plan_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Unlinked Franchisees (for linking)
  const { data: availableFranchisees = [] } = useQuery({
    queryKey: ["available-franchisees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisees").select("id, name, city, status").is("store_plan_id", null).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Linked NSO Checklists
  const { data: linkedNSO = [] } = useQuery({
    queryKey: ["linked-nso", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_checklists").select("*, stores(name)").eq("store_plan_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Unlinked NSO Checklists (for linking)
  const { data: availableNSO = [] } = useQuery({
    queryKey: ["available-nso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_checklists").select("id, name, stores(name), status, start_date").is("store_plan_id", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });


  const addPotentialStore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("potential_stores").insert({
        store_plan_id: id!,
        name: potentialForm.name,
        address: potentialForm.address || null,
        city: potentialForm.city || null,
        state: potentialForm.state || null,
        pin_code: potentialForm.pin_code || null,
        size_sqft: potentialForm.size_sqft ? Number(potentialForm.size_sqft) : null,
        status: potentialForm.status,
        advantages: potentialForm.advantages || null,
        disadvantages: potentialForm.disadvantages || null,
        budget_asked: potentialForm.budget_asked ? Number(potentialForm.budget_asked) : 0,
        available_from: potentialForm.available_from || null,
        contact_person: potentialForm.contact_person || null,
        contact_phone: potentialForm.contact_phone || null,
        notes: potentialForm.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["potential-stores", id] });
      setShowPotentialStoreForm(false);
      setPotentialForm({ name: "", address: "", city: "", state: "", pin_code: "", size_sqft: "", status: "prospective", advantages: "", disadvantages: "", budget_asked: "", available_from: "", contact_person: "", contact_phone: "", notes: "" });
      toast({ title: "Potential store added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePotentialStore = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase.from("potential_stores").delete().eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["potential-stores", id] });
      setDeleteStoreId(null);
      toast({ title: "Potential store removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addApprovalLevel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("store_plan_approval_levels").insert({
        store_plan_id: id!,
        level_order: approvalLevels.length + 1,
        approver_role: approvalForm.approver_role,
        approver_user_id: approvalForm.approver_user_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-plan-approvals", id] });
      setShowApprovalForm(false);
      setApprovalForm({ approver_role: "", approver_user_id: "", level_order: 1 });
      toast({ title: "Approval level added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("store_plans")
        .update({ approval_status: "pending", current_approval_level: 1 })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-plan", id] });
      toast({ title: "Submitted for approval" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleApprovalAction = useMutation({
    mutationFn: async ({ levelId, action }: { levelId: string; action: "approved" | "rejected" }) => {
      const { error: levelError } = await supabase.from("store_plan_approval_levels")
        .update({ status: action, acted_at: new Date().toISOString() })
        .eq("id", levelId);
      if (levelError) throw levelError;

      if (action === "approved") {
        const currentLevel = approvalLevels.find((l) => l.id === levelId);
        const nextLevel = approvalLevels.find((l) => l.level_order === (currentLevel?.level_order || 0) + 1);
        if (nextLevel) {
          await supabase.from("store_plans")
            .update({ current_approval_level: nextLevel.level_order })
            .eq("id", id!);
        } else {
          await supabase.from("store_plans")
            .update({ approval_status: "approved" })
            .eq("id", id!);
        }
      } else {
        await supabase.from("store_plans")
          .update({ approval_status: "rejected" })
          .eq("id", id!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-plan", id] });
      queryClient.invalidateQueries({ queryKey: ["store-plan-approvals", id] });
      toast({ title: "Approval action recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Link/unlink franchisee mutations
  const linkFranchisee = useMutation({
    mutationFn: async (franchiseeId: string) => {
      const { error } = await supabase.from("franchisees").update({ store_plan_id: id }).eq("id", franchiseeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-franchisees", id] });
      queryClient.invalidateQueries({ queryKey: ["available-franchisees"] });
      setShowLinkFranchiseeForm(false);
      setSelectedFranchiseeId("");
      toast({ title: "Franchisee linked to plan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unlinkFranchisee = useMutation({
    mutationFn: async (franchiseeId: string) => {
      const { error } = await supabase.from("franchisees").update({ store_plan_id: null }).eq("id", franchiseeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-franchisees", id] });
      queryClient.invalidateQueries({ queryKey: ["available-franchisees"] });
      toast({ title: "Franchisee unlinked from plan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Link/unlink NSO mutations
  const linkNSO = useMutation({
    mutationFn: async (nsoId: string) => {
      const { error } = await supabase.from("nso_store_checklists").update({ store_plan_id: id }).eq("id", nsoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-nso", id] });
      queryClient.invalidateQueries({ queryKey: ["available-nso"] });
      setShowLinkNSOForm(false);
      setSelectedNSOId("");
      toast({ title: "NSO checklist linked to plan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unlinkNSO = useMutation({
    mutationFn: async (nsoId: string) => {
      const { error } = await supabase.from("nso_store_checklists").update({ store_plan_id: null }).eq("id", nsoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-nso", id] });
      queryClient.invalidateQueries({ queryKey: ["available-nso"] });
      toast({ title: "NSO checklist unlinked from plan" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });


  const handleFileUpload = async (potentialStoreId: string, files: FileList) => {
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${id}/${potentialStoreId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("store-plan-attachments").upload(path, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }
      const { data: { publicUrl } } = supabase.storage
        .from("store-plan-attachments").getPublicUrl(path);
      const fileType = file.type.startsWith("video/") ? "video" : "image";
      await supabase.from("potential_store_attachments").insert({
        potential_store_id: potentialStoreId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileType,
        file_size: file.size,
        uploaded_by: user?.id,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["potential-store-attachments", id] });
    toast({ title: "Files uploaded" });
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!plan) return <div className="p-8 text-center">Plan not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/expansion/plans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <p className="text-muted-foreground">
            {[plan.location, plan.city, plan.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <Badge>{plan.status}</Badge>
        <Badge variant={plan.approval_status === "approved" ? "default" : "outline"}>
          {plan.approval_status}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="text-lg font-bold">₹{Number(plan.estimated_budget || 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Target Date</p>
          <p className="text-lg font-bold">
            {plan.target_open_date ? format(new Date(plan.target_open_date), "dd MMM yyyy") : "—"}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Potential Stores</p>
          <p className="text-lg font-bold">{potentialStores.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Franchisees</p>
          <p className="text-lg font-bold">{linkedFranchisees.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">NSO Checklists</p>
          <p className="text-lg font-bold">{linkedNSO.length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="potential-stores">
        <TabsList className="flex-wrap">
          <TabsTrigger value="potential-stores">Potential Stores</TabsTrigger>
          <TabsTrigger value="franchisees">Franchisees ({linkedFranchisees.length})</TabsTrigger>
          <TabsTrigger value="nso">NSO ({linkedNSO.length})</TabsTrigger>
          <TabsTrigger value="approval">Approval Workflow</TabsTrigger>
          <TabsTrigger value="details">Plan Details</TabsTrigger>
        </TabsList>

        {/* POTENTIAL STORES TAB */}
        <TabsContent value="potential-stores" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Potential Store Locations</h3>
            <PermissionGate moduleKey="stores.nso" action="create">
              <Button size="sm" onClick={() => setShowPotentialStoreForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Store
              </Button>
            </PermissionGate>
          </div>

          {potentialStores.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No potential stores added yet. Click "Add Store" to begin evaluating locations.
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {potentialStores.map((store) => (
                <Card key={store.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{store.name}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {[store.address, store.city, store.state, store.pin_code].filter(Boolean).join(", ") || "No address"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{store.status}</Badge>
                        <PermissionGate moduleKey="stores.nso" action="delete">
                          <Button variant="ghost" size="icon" onClick={() => setDeleteStoreId(store.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Size:</span>
                        <span className="ml-1 font-medium">{store.size_sqft ? `${Number(store.size_sqft).toLocaleString()} sq ft` : "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Budget Asked:</span>
                        <span className="ml-1 font-medium">₹{Number(store.budget_asked || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Available From:</span>
                        <span className="ml-1 font-medium">{store.available_from ? format(new Date(store.available_from), "dd MMM yyyy") : "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="ml-1 font-medium">{store.contact_person || "—"}</span>
                      </div>
                    </div>
                    {(store.advantages || store.disadvantages) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {store.advantages && (
                          <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20">
                            <span className="font-medium text-green-700 dark:text-green-400">Advantages:</span>
                            <p className="mt-1">{store.advantages}</p>
                          </div>
                        )}
                        {store.disadvantages && (
                          <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20">
                            <span className="font-medium text-red-700 dark:text-red-400">Disadvantages:</span>
                            <p className="mt-1">{store.disadvantages}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Attachments */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(attachmentsMap[store.id] || []).map((att) => (
                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-accent">
                          {att.file_type === "video" ? <FileVideo className="h-3 w-3" /> : <FileImage className="h-3 w-3" />}
                          {att.file_name}
                        </a>
                      ))}
                      <label className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 cursor-pointer hover:bg-accent">
                        <Upload className="h-3 w-3" /> Upload
                        <input type="file" multiple accept="image/*,video/*" className="hidden"
                          onChange={(e) => e.target.files && handleFileUpload(store.id, e.target.files)} />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* FRANCHISEES TAB */}
        <TabsContent value="franchisees" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Linked Franchisees</h3>
            <PermissionGate moduleKey="expansion.franchisees" action="edit">
              <Button size="sm" variant="outline" onClick={() => setShowLinkFranchiseeForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Link Franchisee
              </Button>
            </PermissionGate>
          </div>
          {linkedFranchisees.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No franchisees linked to this plan. Link an existing franchisee or create one from the Franchisees module.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {linkedFranchisees.map((f) => (
                <Card key={f.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/expansion/franchisees/${f.id}`)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{f.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[f.interested_location, f.city, f.state].filter(Boolean).join(", ") || "No location"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{f.status}</Badge>
                      <Badge variant="outline" className="capitalize">{f.probability || "—"}</Badge>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); unlinkFranchisee.mutate(f.id); }}>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* NSO TAB */}
        <TabsContent value="nso" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">New Store Openings</h3>
            <PermissionGate moduleKey="stores.nso" action="edit">
              <Button size="sm" variant="outline" onClick={() => setShowLinkNSOForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Link NSO
              </Button>
            </PermissionGate>
          </div>
          {linkedNSO.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No NSO checklists linked. Link an existing checklist from the New Store Opening module.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {linkedNSO.map((nso) => (
                <Card key={nso.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/stores/new-opening/${nso.id}`)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{nso.stores?.name || "Unknown Store"}</p>
                      <p className="text-sm text-muted-foreground">{nso.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start: {format(new Date(nso.start_date), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={nso.status === "completed" ? "default" : "outline"}>{nso.status}</Badge>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); unlinkNSO.mutate(nso.id); }}>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* APPROVAL TAB */}
        <TabsContent value="approval" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Multi-Level Approval</h3>
            <div className="flex gap-2">
              {plan.approval_status === "draft" && approvalLevels.length > 0 && (
                <Button size="sm" onClick={() => submitForApproval.mutate()}>
                  <Send className="h-4 w-4 mr-1" /> Submit for Approval
                </Button>
              )}
              <PermissionGate moduleKey="stores.nso" action="create">
                <Button size="sm" variant="outline" onClick={() => setShowApprovalForm(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Level
                </Button>
              </PermissionGate>
            </div>
          </div>

          {approvalLevels.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No approval levels configured. Add approval levels to enable the workflow.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {approvalLevels.map((level, idx) => {
                const approverProfile = profiles.find((p) => p.id === level.approver_user_id);
                const isCurrentLevel = plan.approval_status === "pending" && level.level_order === plan.current_approval_level;
                const canAct = isCurrentLevel && (level.approver_user_id === user?.id || isAdmin);
                return (
                  <Card key={level.id} className={isCurrentLevel ? "border-primary" : ""}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold ${
                          level.status === "approved" ? "bg-green-100 text-green-700" :
                          level.status === "rejected" ? "bg-red-100 text-red-700" :
                          isCurrentLevel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{level.approver_role}</p>
                          <p className="text-xs text-muted-foreground">
                            {approverProfile?.username || approverProfile?.email || "Unassigned"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {level.status === "approved" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                        {level.status === "rejected" && <XCircle className="h-5 w-5 text-red-600" />}
                        {level.status === "pending" && !isCurrentLevel && <Clock className="h-5 w-5 text-muted-foreground" />}
                        {canAct && (
                          <>
                            <Button size="sm" variant="outline" className="text-green-600"
                              onClick={() => handleApprovalAction.mutate({ levelId: level.id, action: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600"
                              onClick={() => handleApprovalAction.mutate({ levelId: level.id, action: "rejected" })}>
                              Reject
                            </Button>
                          </>
                        )}
                        <Badge variant="outline">{level.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* DETAILS TAB */}
        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><Label className="text-muted-foreground">Description</Label><p>{plan.description || "—"}</p></div>
                <div><Label className="text-muted-foreground">Location</Label><p>{plan.location || "—"}</p></div>
                <div><Label className="text-muted-foreground">City</Label><p>{plan.city || "—"}</p></div>
                <div><Label className="text-muted-foreground">State</Label><p>{plan.state || "—"}</p></div>
                <div><Label className="text-muted-foreground">Region</Label><p>{plan.region || "—"}</p></div>
                <div><Label className="text-muted-foreground">Created</Label><p>{format(new Date(plan.created_at), "dd MMM yyyy")}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Potential Store Dialog */}
      <Dialog open={showPotentialStoreForm} onOpenChange={setShowPotentialStoreForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Add Potential Store</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Store Name *</Label>
                <Input value={potentialForm.name} onChange={(e) => setPotentialForm({ ...potentialForm, name: e.target.value })} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Address</Label>
                <Input value={potentialForm.address} onChange={(e) => setPotentialForm({ ...potentialForm, address: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>City</Label>
                <Input value={potentialForm.city} onChange={(e) => setPotentialForm({ ...potentialForm, city: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>State</Label>
                <Input value={potentialForm.state} onChange={(e) => setPotentialForm({ ...potentialForm, state: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Pin Code</Label>
                <Input value={potentialForm.pin_code} onChange={(e) => setPotentialForm({ ...potentialForm, pin_code: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Size (Sq Ft)</Label>
                <Input type="number" value={potentialForm.size_sqft} onChange={(e) => setPotentialForm({ ...potentialForm, size_sqft: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Budget Asked (₹)</Label>
                <Input type="number" value={potentialForm.budget_asked} onChange={(e) => setPotentialForm({ ...potentialForm, budget_asked: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Available From</Label>
                <Input type="date" value={potentialForm.available_from} onChange={(e) => setPotentialForm({ ...potentialForm, available_from: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Contact Person</Label>
                <Input value={potentialForm.contact_person} onChange={(e) => setPotentialForm({ ...potentialForm, contact_person: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Contact Phone</Label>
                <Input value={potentialForm.contact_phone} onChange={(e) => setPotentialForm({ ...potentialForm, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={potentialForm.status} onValueChange={(v) => setPotentialForm({ ...potentialForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospective">Prospective</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="finalized">Finalized</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Advantages</Label>
                <Textarea value={potentialForm.advantages} onChange={(e) => setPotentialForm({ ...potentialForm, advantages: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Disadvantages</Label>
                <Textarea value={potentialForm.disadvantages} onChange={(e) => setPotentialForm({ ...potentialForm, disadvantages: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Notes</Label>
                <Textarea value={potentialForm.notes} onChange={(e) => setPotentialForm({ ...potentialForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPotentialStoreForm(false)}>Cancel</Button>
            <Button onClick={() => addPotentialStore.mutate()} disabled={!potentialForm.name || addPotentialStore.isPending}>
              {addPotentialStore.isPending ? "Adding..." : "Add Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Approval Level Dialog */}
      <Dialog open={showApprovalForm} onOpenChange={setShowApprovalForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Approval Level</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role / Title *</Label>
              <Input value={approvalForm.approver_role} onChange={(e) => setApprovalForm({ ...approvalForm, approver_role: e.target.value })} placeholder="e.g. Regional Manager, CFO, CEO" />
            </div>
            <div className="space-y-2">
              <Label>Assign to User</Label>
              <Select value={approvalForm.approver_user_id} onValueChange={(v) => setApprovalForm({ ...approvalForm, approver_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.username || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalForm(false)}>Cancel</Button>
            <Button onClick={() => addApprovalLevel.mutate()} disabled={!approvalForm.approver_role || addApprovalLevel.isPending}>
              Add Level
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStoreId} onOpenChange={() => setDeleteStoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Potential Store?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this store and all attachments.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStoreId && deletePotentialStore.mutate(deleteStoreId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Link Franchisee Dialog */}
      <Dialog open={showLinkFranchiseeForm} onOpenChange={setShowLinkFranchiseeForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Franchisee to Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Franchisee</Label>
              <Select value={selectedFranchiseeId} onValueChange={setSelectedFranchiseeId}>
                <SelectTrigger><SelectValue placeholder="Choose a franchisee..." /></SelectTrigger>
                <SelectContent>
                  {availableFranchisees.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} {f.city ? `(${f.city})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableFranchisees.length === 0 && (
              <p className="text-sm text-muted-foreground">No unlinked franchisees available. Create one from the Franchisees module first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkFranchiseeForm(false)}>Cancel</Button>
            <Button onClick={() => linkFranchisee.mutate(selectedFranchiseeId)} disabled={!selectedFranchiseeId || linkFranchisee.isPending}>
              {linkFranchisee.isPending ? "Linking..." : "Link Franchisee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link NSO Dialog */}
      <Dialog open={showLinkNSOForm} onOpenChange={setShowLinkNSOForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link NSO Checklist to Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select NSO Checklist</Label>
              <Select value={selectedNSOId} onValueChange={setSelectedNSOId}>
                <SelectTrigger><SelectValue placeholder="Choose a checklist..." /></SelectTrigger>
                <SelectContent>
                  {availableNSO.map((n: any) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.stores?.name || "Unknown"} — {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableNSO.length === 0 && (
              <p className="text-sm text-muted-foreground">No unlinked NSO checklists available. Create one from New Store Opening first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkNSOForm(false)}>Cancel</Button>
            <Button onClick={() => linkNSO.mutate(selectedNSOId)} disabled={!selectedNSOId || linkNSO.isPending}>
              {linkNSO.isPending ? "Linking..." : "Link NSO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
