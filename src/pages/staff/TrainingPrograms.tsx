import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, GraduationCap, BookOpen, Award, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface TrainingProgram {
  id: string;
  employee_id: string | null;
  program_name: string;
  training_type: string;
  trainer: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  duration_hours: number | null;
  status: string;
  score: number | null;
  feedback: string | null;
  notes: string | null;
  cost: number | null;
  employees?: { name: string; department: string; position: string } | null;
}

interface TrainingForm {
  employee_id: string;
  program_name: string;
  training_type: string;
  trainer: string;
  department: string;
  start_date: string;
  end_date: string;
  duration_hours: string;
  status: string;
  score: string;
  cost: string;
  feedback: string;
  notes: string;
}

const defaultForm: TrainingForm = {
  employee_id: "",
  program_name: "",
  training_type: "internal",
  trainer: "",
  department: "",
  start_date: "",
  end_date: "",
  duration_hours: "",
  status: "scheduled",
  score: "",
  cost: "",
  feedback: "",
  notes: "",
};

const trainingTypes = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "online", label: "Online / E-Learning" },
  { value: "on_the_job", label: "On-the-Job" },
];

const statusOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function TrainingPrograms() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrainingForm>(defaultForm);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["employees-for-training"],
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

  const { data: programs, isLoading } = useQuery({
    queryKey: ["training-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_programs")
        .select("*, employees(name, department, position)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TrainingForm) => {
      const payload = {
        employee_id: data.employee_id || null,
        program_name: data.program_name,
        training_type: data.training_type,
        trainer: data.trainer || null,
        department: data.department || null,
        start_date: data.start_date,
        end_date: data.end_date || null,
        duration_hours: data.duration_hours ? parseFloat(data.duration_hours) : null,
        status: data.status,
        score: data.score ? parseFloat(data.score) : null,
        cost: data.cost ? parseFloat(data.cost) : null,
        feedback: data.feedback || null,
        notes: data.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("training_programs").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-programs"] });
      toast.success(editingId ? "Training updated" : "Training created");
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleEdit = (p: TrainingProgram) => {
    setEditingId(p.id);
    setForm({
      employee_id: p.employee_id || "",
      program_name: p.program_name,
      training_type: p.training_type,
      trainer: p.trainer || "",
      department: p.department || "",
      start_date: p.start_date,
      end_date: p.end_date || "",
      duration_hours: p.duration_hours?.toString() || "",
      status: p.status,
      score: p.score?.toString() || "",
      cost: p.cost?.toString() || "",
      feedback: p.feedback || "",
      notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filtered = (programs || []).filter(p =>
    p.program_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.employees?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.trainer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPrograms = programs?.length || 0;
  const completed = programs?.filter(p => p.status === "completed").length || 0;
  const inProgress = programs?.filter(p => p.status === "in_progress").length || 0;
  const totalCost = programs?.reduce((sum, p) => sum + (p.cost || 0), 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Training Programs</h1>
          <p className="text-muted-foreground">Manage employee training, certifications and skill development</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Training
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><BookOpen className="h-5 w-5 text-primary" /></div>
              <div><div className="text-2xl font-bold">{totalPrograms}</div><div className="text-sm text-muted-foreground">Total Programs</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10"><Calendar className="h-5 w-5 text-yellow-600" /></div>
              <div><div className="text-2xl font-bold">{inProgress}</div><div className="text-sm text-muted-foreground">In Progress</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><Award className="h-5 w-5 text-green-600" /></div>
              <div><div className="text-2xl font-bold">{completed}</div><div className="text-sm text-muted-foreground">Completed</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><GraduationCap className="h-5 w-5 text-purple-600" /></div>
              <div><div className="text-2xl font-bold">₹{totalCost.toLocaleString()}</div><div className="text-sm text-muted-foreground">Total Investment</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search programs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No training programs found</TableCell></TableRow>
              ) : (
                filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.program_name}</TableCell>
                    <TableCell>{p.employees?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.training_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{p.trainer || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(p.start_date), "dd MMM yyyy")}
                      {p.end_date && ` — ${format(new Date(p.end_date), "dd MMM yyyy")}`}
                    </TableCell>
                    <TableCell>{p.duration_hours || "—"}</TableCell>
                    <TableCell>{p.score ? `${p.score}%` : "—"}</TableCell>
                    <TableCell><Badge className={getStatusColor(p.status)}>{p.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Training" : "Add Training Program"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Program Name *</Label>
                <Input value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })} placeholder="e.g. Fire Safety Training" />
              </div>
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name} - {emp.position}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Training Type</Label>
                <Select value={form.training_type} onValueChange={(v) => setForm({ ...form, training_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {trainingTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trainer / Instructor</Label>
                <Input value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} placeholder="Trainer name" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Duration (Hours)</Label>
                <Input type="number" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Score (%)</Label>
                <Input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cost (₹)</Label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Feedback / Observations</Label>
              <Textarea value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="Training feedback..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="pt-4 border-t">
            <Button onClick={() => { if (!form.program_name || !form.start_date) { toast.error("Program name and start date are required"); return; } saveMutation.mutate(form); }} className="w-full">
              {editingId ? "Update Training" : "Create Training"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
