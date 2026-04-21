import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Camera, Building, User, Star, MessageSquare,
  Paperclip, Upload, Plus, History, Briefcase, Target, Trash2, Loader2,
} from "lucide-react";

export default function EmployeeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  // Employee data
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const [storeResult, managerResult] = await Promise.all([
        data.store_id
          ? supabase.from("stores").select("id, name").eq("id", data.store_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        data.manager_id
          ? supabase.from("employees").select("id, name").eq("id", data.manager_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (storeResult.error) throw storeResult.error;
      if (managerResult.error) throw managerResult.error;

      return {
        ...data,
        stores: storeResult.data,
        manager: managerResult.data,
      };
    },
    enabled: !!id,
  });

  // Stores lookup
  const { data: stores } = useQuery({
    queryKey: ["stores-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").order("name");
      return data || [];
    },
  });

  // All employees for reports-to
  const { data: allEmployees } = useQuery({
    queryKey: ["employees-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  // Transfer history
  const { data: transfers } = useQuery({
    queryKey: ["employee-transfers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_transfer_history")
        .select("*, from_store:stores!employee_transfer_history_from_store_id_fkey(name), to_store:stores!employee_transfer_history_to_store_id_fkey(name)")
        .eq("employee_id", id!)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Performance records
  const { data: performanceRecords } = useQuery({
    queryKey: ["employee-performance", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_performance_records")
        .select("*")
        .eq("employee_id", id!)
        .order("review_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Feedback - using employee_feedback table (linked to profiles)
  // We'll also query by employee_id matching
  const { data: feedbackRecords } = useQuery({
    queryKey: ["employee-feedback-records", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_feedback")
        .select("*")
        .or(`employee_id.eq.${id}`)
        .order("feedback_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Attachments
  const { data: attachments } = useQuery({
    queryKey: ["employee-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_attachments")
        .select("*")
        .eq("employee_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop();
      const path = `employee-photos/${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("employee-documents").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("employees")
        .update({ photo_url: urlData.publicUrl })
        .eq("id", id!);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
      toast.success("Photo updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Attachment upload
  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `attachments/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("employee-documents").getPublicUrl(path);
      const { error: insertError } = await supabase.from("employee_attachments").insert({
        employee_id: id!,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-attachments", id] });
      toast.success("Attachment uploaded");
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete attachment
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase.from("employee_attachments").delete().eq("id", attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-attachments", id] });
      toast.success("Attachment removed");
    },
  });

  // Update employee field
  const updateFieldMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const { error } = await supabase.from("employees").update({ [field]: value }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!employee) {
    return <div className="text-center py-12">Employee not found</div>;
  }

  const initials = employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/staff/employees")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Employees
      </Button>

      {/* Header Card with Photo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={employee.photo_url || ""} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <button
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhotoMutation.mutate(file);
                }}
              />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{employee.name}</h1>
              <p className="text-muted-foreground">{employee.position} · {employee.department}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {(employee.stores as any)?.name && (
                  <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{(employee.stores as any).name}</span>
                )}
                {(employee.manager as any)?.name && (
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Reports to: {(employee.manager as any).name}</span>
                )}
                <span>Joined: {format(new Date(employee.join_date), "dd MMM yyyy")}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant={employee.status === "active" ? "default" : "secondary"}>{employee.status}</Badge>
                {employee.experience_years && (
                  <Badge variant="outline"><Briefcase className="h-3 w-3 mr-1" />{employee.experience_years} yrs exp</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div>
              <Label className="text-xs text-muted-foreground">Deployed Store</Label>
              <Select
                value={employee.store_id || ""}
                onValueChange={(v) => updateFieldMutation.mutate({ field: "store_id", value: v || null })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {stores?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reports To</Label>
              <Select
                value={employee.manager_id || ""}
                onValueChange={(v) => updateFieldMutation.mutate({ field: "manager_id", value: v || null })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {allEmployees?.filter(e => e.id !== id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Experience (Years)</Label>
              <Input
                type="number"
                step="0.5"
                className="mt-1"
                defaultValue={employee.experience_years ?? ""}
                onBlur={(e) => updateFieldMutation.mutate({ field: "experience_years", value: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Previous Experience</Label>
              <Textarea
                className="mt-1"
                rows={2}
                defaultValue={employee.previous_experience ?? ""}
                onBlur={(e) => updateFieldMutation.mutate({ field: "previous_experience", value: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3.5 w-3.5" />Career Aspiration</Label>
              <Textarea
                className="mt-1"
                rows={2}
                defaultValue={employee.aspiration ?? ""}
                onBlur={(e) => updateFieldMutation.mutate({ field: "aspiration", value: e.target.value || null })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Lists */}
      <Tabs defaultValue="transfers">
        <TabsList>
          <TabsTrigger value="transfers"><History className="h-3.5 w-3.5 mr-1" />Transfer History</TabsTrigger>
          <TabsTrigger value="performance"><Star className="h-3.5 w-3.5 mr-1" />Performance</TabsTrigger>
          <TabsTrigger value="feedback"><MessageSquare className="h-3.5 w-3.5 mr-1" />Feedback</TabsTrigger>
          <TabsTrigger value="attachments"><Paperclip className="h-3.5 w-3.5 mr-1" />Attachments</TabsTrigger>
        </TabsList>

        {/* Transfer History */}
        <TabsContent value="transfers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Transfer / Movement History</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setTransferDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Record Transfer
              </Button>
            </CardHeader>
            <CardContent>
              {!transfers?.length ? (
                <p className="text-sm text-muted-foreground py-4">No transfer history recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Store</TableHead>
                      <TableHead>To Store</TableHead>
                      <TableHead>From Dept/Position</TableHead>
                      <TableHead>To Dept/Position</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{format(new Date(t.effective_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{(t.from_store as any)?.name || t.from_department || "—"}</TableCell>
                        <TableCell>{(t.to_store as any)?.name || t.to_department || "—"}</TableCell>
                        <TableCell>{[t.from_department, t.from_position].filter(Boolean).join(" / ") || "—"}</TableCell>
                        <TableCell>{[t.to_department, t.to_position].filter(Boolean).join(" / ") || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Performance Records</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setPerformanceDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Review
              </Button>
            </CardHeader>
            <CardContent>
              {!performanceRecords?.length ? (
                <p className="text-sm text-muted-foreground py-4">No performance records yet.</p>
              ) : (
                <div className="space-y-3">
                  {performanceRecords.map((pr: any) => (
                    <div key={pr.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < pr.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{pr.reviewer_name}</span>
                          {pr.review_period && <Badge variant="outline" className="text-[10px]">{pr.review_period}</Badge>}
                        </div>
                        {pr.review_text && <p className="text-sm text-muted-foreground mt-1">{pr.review_text}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(pr.review_date), "dd MMM yyyy")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Feedback</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setFeedbackDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Feedback
              </Button>
            </CardHeader>
            <CardContent>
              {!feedbackRecords?.length ? (
                <p className="text-sm text-muted-foreground py-4">No feedback records.</p>
              ) : (
                <div className="space-y-3">
                  {feedbackRecords.map((fb: any) => (
                    <div key={fb.id} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">{fb.feedback_type}</Badge>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < fb.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground ml-auto">{format(new Date(fb.feedback_date), "dd MMM yyyy")}</span>
                      </div>
                      {fb.feedback_text && <p className="text-sm text-muted-foreground">{fb.feedback_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attachments */}
        <TabsContent value="attachments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attachments</CardTitle>
              <Button size="sm" variant="outline" onClick={() => attachInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" />Upload
              </Button>
              <input
                ref={attachInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAttachmentMutation.mutate(file);
                }}
              />
            </CardHeader>
            <CardContent>
              {!attachments?.length ? (
                <p className="text-sm text-muted-foreground py-4">No attachments.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att: any) => (
                    <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg border group">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">{att.file_name}</a>
                        <p className="text-xs text-muted-foreground">{format(new Date(att.created_at), "dd MMM yyyy")}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteAttachmentMutation.mutate(att.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transfer Dialog */}
      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        employeeId={id!}
        employee={employee}
        stores={stores || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["employee-transfers", id] });
          queryClient.invalidateQueries({ queryKey: ["employee-detail", id] });
        }}
      />

      {/* Performance Dialog */}
      <PerformanceDialog
        open={performanceDialogOpen}
        onOpenChange={setPerformanceDialogOpen}
        employeeId={id!}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["employee-performance", id] })}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        employeeId={id!}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["employee-feedback-records", id] })}
      />
    </div>
  );
}

// --- Sub-dialogs ---

function TransferDialog({ open, onOpenChange, employeeId, employee, stores, onSuccess }: any) {
  const [toStoreId, setToStoreId] = useState("");
  const [toDept, setToDept] = useState("");
  const [toPos, setToPos] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const mutation = useMutation({
    mutationFn: async () => {
      // Record history
      const { error: histError } = await supabase.from("employee_transfer_history").insert({
        employee_id: employeeId,
        from_store_id: employee.store_id || null,
        to_store_id: toStoreId || null,
        from_department: employee.department,
        to_department: toDept || employee.department,
        from_position: employee.position,
        to_position: toPos || employee.position,
        effective_date: effectiveDate,
        reason,
      });
      if (histError) throw histError;

      // Update employee record
      const updates: any = {};
      if (toStoreId) updates.store_id = toStoreId;
      if (toDept) updates.department = toDept;
      if (toPos) updates.position = toPos;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("employees").update(updates).eq("id", employeeId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Transfer recorded");
      onSuccess();
      onOpenChange(false);
      setToStoreId(""); setToDept(""); setToPos(""); setReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const departments = ["Operations", "Sales", "Security", "Housekeeping", "IT", "Management"];
  const positions = ["Store Manager", "Assistant Manager", "Sales Associate", "Cashier", "Security Guard", "Housekeeper"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Transfer / Movement</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div>
            <Label>To Store</Label>
            <Select value={toStoreId} onValueChange={setToStoreId}>
              <SelectTrigger><SelectValue placeholder="Select new store (optional)" /></SelectTrigger>
              <SelectContent>
                {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>New Department</Label>
              <Select value={toDept} onValueChange={setToDept}>
                <SelectTrigger><SelectValue placeholder="Same" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Position</Label>
              <Select value={toPos} onValueChange={setToPos}>
                <SelectTrigger><SelectValue placeholder="Same" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for transfer..." rows={2} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Record Transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerformanceDialog({ open, onOpenChange, employeeId, onSuccess }: any) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [reviewDate, setReviewDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!rating || !reviewerName) throw new Error("Rating and reviewer name are required");
      const { error } = await supabase.from("employee_performance_records").insert({
        employee_id: employeeId,
        rating,
        review_text: reviewText || null,
        reviewer_name: reviewerName,
        review_period: reviewPeriod || null,
        review_date: reviewDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Performance record added");
      onSuccess();
      onOpenChange(false);
      setRating(0); setReviewText(""); setReviewerName(""); setReviewPeriod("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Performance Review</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Reviewer Name</Label>
            <Input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Manager name" />
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setRating(s)}>
                  <Star className={`h-6 w-6 transition-colors ${s <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30 hover:text-yellow-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Review Period</Label>
              <Input value={reviewPeriod} onChange={(e) => setReviewPeriod(e.target.value)} placeholder="e.g. Q1 2026" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Performance notes..." rows={3} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !rating}>
            Save Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({ open, onOpenChange, employeeId, onSuccess }: any) {
  const [feedbackType, setFeedbackType] = useState("manager");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!rating) throw new Error("Rating is required");
      const { error } = await supabase.from("employee_feedback").insert({
        employee_id: employeeId,
        feedback_type: feedbackType,
        rating,
        feedback_text: text || null,
        feedback_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback recorded");
      onSuccess();
      onOpenChange(false);
      setRating(0); setText(""); setFeedbackType("manager");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Feedback</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">From Manager</SelectItem>
                <SelectItem value="peer">From Peer</SelectItem>
                <SelectItem value="self">Self Assessment</SelectItem>
                <SelectItem value="team">Team Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setRating(s)}>
                  <Star className={`h-6 w-6 transition-colors ${s <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30 hover:text-yellow-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Feedback details..." rows={3} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !rating}>
            Submit Feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
