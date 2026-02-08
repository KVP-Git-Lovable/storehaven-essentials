import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, UserMinus, ClipboardCheck, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

interface Offboarding {
  id: string;
  employee_id: string;
  resignation_date: string;
  last_working_date: string | null;
  reason: string;
  exit_interview_done: boolean;
  exit_interview_notes: string | null;
  exit_interview_date: string | null;
  handover_to: string | null;
  handover_status: string;
  knowledge_transfer_done: boolean;
  assets_returned: boolean;
  id_card_returned: boolean;
  it_access_revoked: boolean;
  final_settlement_status: string;
  final_settlement_amount: number | null;
  rehire_eligible: boolean;
  rehire_notes: string | null;
  status: string;
  notes: string | null;
  processed_by: string | null;
  employees?: { name: string; department: string; position: string };
}

interface OffboardingForm {
  employee_id: string;
  resignation_date: string;
  last_working_date: string;
  reason: string;
  handover_to: string;
  notes: string;
  processed_by: string;
}

const defaultForm: OffboardingForm = {
  employee_id: "",
  resignation_date: "",
  last_working_date: "",
  reason: "resignation",
  handover_to: "",
  notes: "",
  processed_by: "",
};

const reasonOptions = [
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "retirement", label: "Retirement" },
  { value: "contract_end", label: "Contract End" },
  { value: "absconding", label: "Absconding" },
];

export default function EmployeeOffboarding() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<OffboardingForm>(defaultForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailRecord, setDetailRecord] = useState<Offboarding | null>(null);
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["employees-for-offboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, department, position")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["offboarding-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_offboarding")
        .select("*, employees(name, department, position)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Offboarding[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OffboardingForm) => {
      const { error } = await supabase.from("employee_offboarding").insert({
        employee_id: data.employee_id,
        resignation_date: data.resignation_date,
        last_working_date: data.last_working_date || null,
        reason: data.reason,
        handover_to: data.handover_to || null,
        notes: data.notes || null,
        processed_by: data.processed_by || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offboarding-records"] });
      toast.success("Offboarding initiated");
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateChecklist = async (id: string, field: string, value: boolean) => {
    const { error } = await supabase
      .from("employee_offboarding")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["offboarding-records"] });
    // Also update detail record if open
    if (detailRecord?.id === id) {
      setDetailRecord(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("employee_offboarding")
      .update({ status })
      .eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    queryClient.invalidateQueries({ queryKey: ["offboarding-records"] });
    toast.success(`Status updated to ${status}`);
    if (detailRecord?.id === id) setDetailRecord(prev => prev ? { ...prev, status } : null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "initiated": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case "resignation": return "bg-blue-100 text-blue-800";
      case "termination": return "bg-red-100 text-red-800";
      case "retirement": return "bg-purple-100 text-purple-800";
      case "absconding": return "bg-orange-100 text-orange-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filtered = (records || []).filter(r =>
    r.employees?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const total = records?.length || 0;
  const initiated = records?.filter(r => r.status === "initiated").length || 0;
  const inProgress = records?.filter(r => r.status === "in_progress").length || 0;
  const completed = records?.filter(r => r.status === "completed").length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employee Offboarding</h1>
          <p className="text-muted-foreground">Manage exit process, clearance and knowledge transfer</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Initiate Offboarding
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><UserMinus className="h-5 w-5 text-primary" /></div><div><div className="text-2xl font-bold">{total}</div><div className="text-sm text-muted-foreground">Total Exits</div></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><AlertTriangle className="h-5 w-5 text-blue-600" /></div><div><div className="text-2xl font-bold">{initiated}</div><div className="text-sm text-muted-foreground">Initiated</div></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10"><ClipboardCheck className="h-5 w-5 text-yellow-600" /></div><div><div className="text-2xl font-bold">{inProgress}</div><div className="text-sm text-muted-foreground">In Progress</div></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><div className="text-2xl font-bold">{completed}</div><div className="text-sm text-muted-foreground">Completed</div></div></div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Resignation Date</TableHead>
                <TableHead>Last Working Day</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No offboarding records</TableCell></TableRow>
              ) : (
                filtered.map(r => {
                  const clearanceCount = [r.assets_returned, r.id_card_returned, r.it_access_revoked, r.knowledge_transfer_done].filter(Boolean).length;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetailRecord(r)}>
                      <TableCell className="font-medium">{r.employees?.name || "—"}</TableCell>
                      <TableCell>{r.employees?.department || "—"}</TableCell>
                      <TableCell><Badge className={getReasonColor(r.reason)}>{r.reason.replace("_", " ")}</Badge></TableCell>
                      <TableCell>{format(new Date(r.resignation_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{r.last_working_date ? format(new Date(r.last_working_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{clearanceCount}/4</Badge></TableCell>
                      <TableCell><Badge className={getStatusColor(r.status)}>{r.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailRecord(r); }}>View</Button></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Initiate Offboarding</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} - {emp.position}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reasonOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resignation Date *</Label>
                <Input type="date" value={form.resignation_date} onChange={(e) => setForm({ ...form, resignation_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Working Date</Label>
                <Input type="date" value={form.last_working_date} onChange={(e) => setForm({ ...form, last_working_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Handover To</Label>
              <Input value={form.handover_to} onChange={(e) => setForm({ ...form, handover_to: e.target.value })} placeholder="Person taking over" />
            </div>
            <div className="space-y-2">
              <Label>Processed By</Label>
              <Input value={form.processed_by} onChange={(e) => setForm({ ...form, processed_by: e.target.value })} placeholder="HR person name" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
            </div>
          </div>
          <div className="pt-4 border-t">
            <Button onClick={() => {
              if (!form.employee_id || !form.resignation_date) { toast.error("Employee and resignation date are required"); return; }
              createMutation.mutate(form);
            }} className="w-full">Initiate Offboarding</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={!!detailRecord} onOpenChange={(open) => { if (!open) setDetailRecord(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {detailRecord && (
            <>
              <SheetHeader>
                <SheetTitle>Offboarding — {detailRecord.employees?.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{detailRecord.employees?.department}</span></div>
                  <div><span className="text-muted-foreground">Position:</span> <span className="font-medium">{detailRecord.employees?.position}</span></div>
                  <div><span className="text-muted-foreground">Reason:</span> <Badge className={getReasonColor(detailRecord.reason)}>{detailRecord.reason}</Badge></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={getStatusColor(detailRecord.status)}>{detailRecord.status}</Badge></div>
                  <div><span className="text-muted-foreground">Resignation:</span> <span className="font-medium">{format(new Date(detailRecord.resignation_date), "dd MMM yyyy")}</span></div>
                  <div><span className="text-muted-foreground">Last Day:</span> <span className="font-medium">{detailRecord.last_working_date ? format(new Date(detailRecord.last_working_date), "dd MMM yyyy") : "TBD"}</span></div>
                  {detailRecord.handover_to && <div><span className="text-muted-foreground">Handover To:</span> <span className="font-medium">{detailRecord.handover_to}</span></div>}
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Clearance Checklist</h3>
                  <div className="space-y-3">
                    {[
                      { field: "assets_returned", label: "Company Assets Returned" },
                      { field: "id_card_returned", label: "ID Card Returned" },
                      { field: "it_access_revoked", label: "IT Access Revoked" },
                      { field: "knowledge_transfer_done", label: "Knowledge Transfer Completed" },
                      { field: "exit_interview_done", label: "Exit Interview Completed" },
                    ].map(item => (
                      <div key={item.field} className="flex items-center gap-3">
                        <Checkbox
                          checked={(detailRecord as any)[item.field] || false}
                          onCheckedChange={(checked) => updateChecklist(detailRecord.id, item.field, !!checked)}
                        />
                        <span className="text-sm">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Settlement</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Handover Status:</span> <Badge variant="outline">{detailRecord.handover_status}</Badge></div>
                    <div><span className="text-muted-foreground">Settlement:</span> <Badge variant="outline">{detailRecord.final_settlement_status}</Badge></div>
                    <div><span className="text-muted-foreground">Rehire Eligible:</span> <span className="font-medium">{detailRecord.rehire_eligible ? "Yes" : "No"}</span></div>
                  </div>
                </div>

                {detailRecord.notes && (
                  <div><h3 className="font-semibold mb-1">Notes</h3><p className="text-sm text-muted-foreground">{detailRecord.notes}</p></div>
                )}

                <div className="flex gap-2">
                  {detailRecord.status === "initiated" && (
                    <Button onClick={() => updateStatus(detailRecord.id, "in_progress")} variant="outline">Mark In Progress</Button>
                  )}
                  {detailRecord.status === "in_progress" && (
                    <Button onClick={() => updateStatus(detailRecord.id, "completed")} className="bg-green-600 hover:bg-green-700">Complete Offboarding</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
