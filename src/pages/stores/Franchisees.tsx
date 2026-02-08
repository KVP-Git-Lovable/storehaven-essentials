import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Eye, Trash2, Users, UserCheck, UserPlus, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  evaluation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  negotiation: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  agreement: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  onboarding: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const probabilityColors: Record<string, string> = {
  high: "text-green-600", medium: "text-yellow-600", low: "text-red-600",
};

export default function Franchisees() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", interested_location: "", city: "", state: "",
    status: "lead", sign_up_by_date: "", probability: "medium",
    previous_work_experience: "", infrastructure_details: "",
    current_business_background: "", notes: "", store_plan_id: "",
  });

  const { data: storePlans = [] } = useQuery({
    queryKey: ["store-plans-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_plans").select("id, name, city").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: franchisees = [], isLoading } = useQuery({
    queryKey: ["franchisees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchisees").select("*, store_plans:store_plan_id(id, name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("franchisees").insert({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        interested_location: form.interested_location || null,
        city: form.city || null,
        state: form.state || null,
        status: form.status,
        sign_up_by_date: form.sign_up_by_date || null,
        probability: form.probability,
        previous_work_experience: form.previous_work_experience || null,
        infrastructure_details: form.infrastructure_details || null,
        current_business_background: form.current_business_background || null,
        notes: form.notes || null,
        created_by: user?.id,
        store_plan_id: form.store_plan_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Franchisee added successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("franchisees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      setDeleteId(null);
      toast({ title: "Franchisee deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => setForm({
    name: "", email: "", phone: "", interested_location: "", city: "", state: "",
    status: "lead", sign_up_by_date: "", probability: "medium",
    previous_work_experience: "", infrastructure_details: "",
    current_business_background: "", notes: "", store_plan_id: "",
  });

  const filtered = franchisees.filter((f) =>
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.city?.toLowerCase().includes(search.toLowerCase()) ||
    f.interested_location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Franchisees</h1>
          <p className="text-muted-foreground">Manage franchise partners and onboarding</p>
        </div>
        <PermissionGate moduleKey="stores.nso" action="create">
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Franchisee
          </Button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-2xl font-bold">{franchisees.length}</span></div>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-blue-500" /><span className="text-2xl font-bold">{franchisees.filter(f => f.status === 'lead').length}</span></div>
          <p className="text-xs text-muted-foreground">Leads</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-500" /><span className="text-2xl font-bold">{franchisees.filter(f => f.status === 'onboarding').length}</span></div>
          <p className="text-xs text-muted-foreground">Onboarding</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-500" /><span className="text-2xl font-bold">{franchisees.filter(f => f.status === 'active').length}</span></div>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search franchisees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Store Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Sign-up By</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No franchisees found</TableCell></TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => navigate(`/expansion/franchisees/${f.id}`)}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{f.name}</span>
                        {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{[f.interested_location, f.city].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell>
                      {(f as any).store_plans?.name ? (
                        <Badge variant="outline" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/expansion/plans/${(f as any).store_plans.id}`); }}>
                          {(f as any).store_plans.name}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge className={statusColors[f.status] || ""}>{f.status}</Badge></TableCell>
                    <TableCell>
                      <span className={`font-medium ${probabilityColors[f.probability || "medium"]}`}>
                        {f.probability || "medium"}
                      </span>
                    </TableCell>
                    <TableCell>{f.sign_up_by_date ? format(new Date(f.sign_up_by_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{f.onboarding_status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/expansion/franchisees/${f.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <PermissionGate moduleKey="stores.nso" action="delete">
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Add Franchisee</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2"><Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Interested Location</Label>
                <Input value={form.interested_location} onChange={(e) => setForm({ ...form, interested_location: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="evaluation">Evaluation</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Sign-up By Date</Label>
                <Input type="date" value={form.sign_up_by_date} onChange={(e) => setForm({ ...form, sign_up_by_date: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Probability of Signing</Label>
                <Select value={form.probability} onValueChange={(v) => setForm({ ...form, probability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Previous Work Experience</Label>
                <Textarea value={form.previous_work_experience} onChange={(e) => setForm({ ...form, previous_work_experience: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Infrastructure Details</Label>
                <Textarea value={form.infrastructure_details} onChange={(e) => setForm({ ...form, infrastructure_details: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Current Business Background</Label>
                <Textarea value={form.current_business_background} onChange={(e) => setForm({ ...form, current_business_background: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-2 space-y-2"><Label>Link to Store Plan</Label>
                <Select value={form.store_plan_id} onValueChange={(v) => setForm({ ...form, store_plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional — link to a store plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {storePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} {p.city ? `(${p.city})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Franchisee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Franchisee?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this franchisee and all related data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
