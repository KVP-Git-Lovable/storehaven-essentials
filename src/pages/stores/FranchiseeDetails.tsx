import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Upload, FileText, Trash2, CheckCircle2, Circle, Download,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FranchiseeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const { data: franchisee, isLoading } = useQuery({
    queryKey: ["franchisee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisees").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["franchisee-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisee_documents").select("*").eq("franchisee_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: checklistItems = [] } = useQuery({
    queryKey: ["franchisee-onboarding-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisee_onboarding_items").select("*").eq("status", "active").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["franchisee-onboarding-progress", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisee_onboarding_progress").select("*").eq("franchisee_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const toggleChecklist = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const existing = progress.find((p) => p.checklist_item_id === itemId);
      if (existing) {
        const { error } = await supabase.from("franchisee_onboarding_progress")
          .update({
            is_completed: completed,
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: completed ? user?.id : null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("franchisee_onboarding_progress").insert({
          franchisee_id: id!,
          checklist_item_id: itemId,
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? user?.id : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisee-onboarding-progress", id] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateOnboardingStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("franchisees")
        .update({ onboarding_status: status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisee", id] });
      toast({ title: "Onboarding status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDocUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("franchisee-documents").upload(path, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }
      const { data: { publicUrl } } = supabase.storage
        .from("franchisee-documents").getPublicUrl(path);
      await supabase.from("franchisee_documents").insert({
        franchisee_id: id!,
        document_name: file.name,
        file_name: file.name,
        file_url: publicUrl,
        document_type: file.type.startsWith("image/") ? "image" : "document",
        uploaded_by: user?.id,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["franchisee-documents", id] });
    toast({ title: "Documents uploaded" });
  };

  const deleteDoc = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("franchisee_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisee-documents", id] });
      setDeleteDocId(null);
      toast({ title: "Document deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!franchisee) return <div className="p-8 text-center">Franchisee not found</div>;

  const completedCount = progress.filter((p) => p.is_completed).length;
  const totalItems = checklistItems.length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/expansion/franchisees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{franchisee.name}</h1>
          <p className="text-muted-foreground">
            {[franchisee.interested_location, franchisee.city, franchisee.state].filter(Boolean).join(", ")}
          </p>
        </div>
        <Badge>{franchisee.status}</Badge>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Contact</p>
          <p className="font-medium">{franchisee.phone || franchisee.email || "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Probability</p>
          <p className="font-medium capitalize">{franchisee.probability || "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Sign-up By</p>
          <p className="font-medium">{franchisee.sign_up_by_date ? format(new Date(franchisee.sign_up_by_date), "dd MMM yyyy") : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Onboarding</p>
          <p className="font-medium capitalize">{franchisee.onboarding_status.replace(/_/g, " ")}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding ({completedCount}/{totalItems})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><Label className="text-muted-foreground">Email</Label><p>{franchisee.email || "—"}</p></div>
                <div><Label className="text-muted-foreground">Phone</Label><p>{franchisee.phone || "—"}</p></div>
                <div><Label className="text-muted-foreground">Interested Location</Label><p>{franchisee.interested_location || "—"}</p></div>
                <div><Label className="text-muted-foreground">City / State</Label><p>{[franchisee.city, franchisee.state].filter(Boolean).join(", ") || "—"}</p></div>
              </div>
              <div className="space-y-4">
                <div><Label className="text-muted-foreground">Previous Work Experience</Label><p className="whitespace-pre-wrap">{franchisee.previous_work_experience || "—"}</p></div>
                <div><Label className="text-muted-foreground">Infrastructure Details</Label><p className="whitespace-pre-wrap">{franchisee.infrastructure_details || "—"}</p></div>
                <div><Label className="text-muted-foreground">Current Business Background</Label><p className="whitespace-pre-wrap">{franchisee.current_business_background || "—"}</p></div>
                <div><Label className="text-muted-foreground">Notes</Label><p className="whitespace-pre-wrap">{franchisee.notes || "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Documents & Pictures</h3>
            <label className="cursor-pointer">
              <Button size="sm" asChild>
                <span><Upload className="h-4 w-4 mr-1" /> Upload</span>
              </Button>
              <input type="file" multiple className="hidden" onChange={(e) => e.target.files && handleDocUpload(e.target.files)} />
            </label>
          </div>

          {documents.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No documents uploaded yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-4 flex items-center gap-3">
                    {doc.document_type === "image" ? (
                      <img src={doc.file_url} alt={doc.file_name} className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.document_name || doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "dd MMM yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDocId(doc.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Onboarding Checklist</h3>
              <p className="text-sm text-muted-foreground">{completedCount} of {totalItems} items completed</p>
            </div>
            <PermissionGate moduleKey="stores.nso" action="edit">
              <div className="flex gap-2">
                {franchisee.onboarding_status === "not_started" && (
                  <Button size="sm" onClick={() => updateOnboardingStatus.mutate("in_progress")}>Start Onboarding</Button>
                )}
                {franchisee.onboarding_status === "in_progress" && progressPct === 100 && (
                  <Button size="sm" onClick={() => updateOnboardingStatus.mutate("completed")}>Mark Complete</Button>
                )}
              </div>
            </PermissionGate>
          </div>

          <Progress value={progressPct} className="h-2" />

          {checklistItems.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              No onboarding checklist items configured. Add items in the Admin section.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {checklistItems.map((item) => {
                const prog = progress.find((p) => p.checklist_item_id === item.id);
                const isCompleted = prog?.is_completed || false;
                return (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={(checked) =>
                          toggleChecklist.mutate({ itemId: item.id, completed: !!checked })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {item.title}
                          </span>
                          {item.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                        {isCompleted && prog?.completed_at && (
                          <p className="text-xs text-green-600 mt-1">
                            Completed {format(new Date(prog.completed_at), "dd MMM yyyy")}
                          </p>
                        )}
                      </div>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this document.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDocId && deleteDoc.mutate(deleteDocId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
