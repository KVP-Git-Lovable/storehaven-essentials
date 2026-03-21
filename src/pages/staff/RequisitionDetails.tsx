import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Loader2, Building, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Requisition = {
  id: string; title: string; department: string; position: string;
  number_of_openings: number; priority: string; status: string;
  description: string | null; requirements: string | null;
  salary_range_min: number | null; salary_range_max: number | null;
  target_join_date: string | null; created_at: string;
};

type StoreAllocation = {
  id: string; requisition_id: string; store_id: string; positions_count: number; filled_count: number;
  store?: { name: string } | null;
};

type Candidate = {
  id: string; name: string; email: string | null; status: string;
  source: string | null; experience_years: number | null;
};

const statusColors: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800", screening: "bg-purple-100 text-purple-800",
  interview: "bg-amber-100 text-amber-800", selected: "bg-green-100 text-green-800",
  offer_sent: "bg-emerald-100 text-emerald-800", offer_accepted: "bg-teal-100 text-teal-800",
  joined: "bg-green-200 text-green-900", rejected: "bg-red-100 text-red-800", withdrawn: "bg-gray-100 text-gray-800",
};

export default function RequisitionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [allocations, setAllocations] = useState<StoreAllocation[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({ store_id: "", positions_count: "1" });

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [rRes, aRes, cRes, sRes] = await Promise.all([
      supabase.from("job_requisitions").select("*").eq("id", id!).single(),
      supabase.from("requisition_store_allocations").select("*, store:stores(name)").eq("requisition_id", id!),
      supabase.from("candidates").select("*").eq("requisition_id", id!).order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").order("name"),
    ]);
    if (rRes.data) setRequisition(rRes.data as any);
    if (aRes.data) setAllocations(aRes.data as any);
    if (cRes.data) setCandidates(cRes.data);
    if (sRes.data) setStores(sRes.data);
    setLoading(false);
  };

  const addAllocation = async () => {
    const { error } = await supabase.from("requisition_store_allocations").insert({
      requisition_id: id!, store_id: allocForm.store_id,
      positions_count: parseInt(allocForm.positions_count) || 1,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Store allocation added" });
    setAllocDialogOpen(false);
    setAllocForm({ store_id: "", positions_count: "1" });
    fetchAll();
  };

  const updateStatus = async (status: string) => {
    await supabase.from("job_requisitions").update({ status }).eq("id", id!);
    toast({ title: "Status updated" });
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!requisition) return <div className="text-center py-12">Requisition not found</div>;

  const totalAllocated = allocations.reduce((s, a) => s + a.positions_count, 0);
  const totalFilled = allocations.reduce((s, a) => s + a.filled_count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate("/staff/recruitment")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Recruitment
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{requisition.title}</h1>
          <p className="text-muted-foreground">{requisition.department} · {requisition.position}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={requisition.priority === "high" ? "destructive" : "default"}>{requisition.priority}</Badge>
          <Select value={requisition.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{requisition.number_of_openings}</p><p className="text-xs text-muted-foreground">Total Openings</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{totalAllocated}</p><p className="text-xs text-muted-foreground">Allocated to Stores</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{totalFilled}</p><p className="text-xs text-muted-foreground">Filled</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{candidates.length}</p><p className="text-xs text-muted-foreground">Candidates</p></CardContent></Card>
      </div>

      {requisition.description && (
        <Card><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{requisition.description}</p></CardContent></Card>
      )}

      {/* Store Allocations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Store-wise Fulfilment Plan</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAllocDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add Store</Button>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No store allocations yet. Add stores to create a fulfilment plan.</p>
          ) : (
            <div className="space-y-3">
              {allocations.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{(a.store as any)?.name}</p>
                      <p className="text-xs text-muted-foreground">{a.filled_count} / {a.positions_count} filled</p>
                    </div>
                  </div>
                  <Progress value={(a.filled_count / a.positions_count) * 100} className="w-24 h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidates */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Candidates ({candidates.length})</CardTitle></CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates linked to this requisition.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.experience_years != null ? `${c.experience_years} yrs` : "—"}</TableCell>
                    <TableCell className="capitalize">{c.source || "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[c.status] || "bg-gray-100 text-gray-800"}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Allocation Dialog */}
      <Dialog open={allocDialogOpen} onOpenChange={setAllocDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Store Allocation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Store</Label>
              <Select value={allocForm.store_id} onValueChange={v => setAllocForm(p => ({ ...p, store_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label># of Positions</Label>
              <Input type="number" min={1} value={allocForm.positions_count} onChange={e => setAllocForm(p => ({ ...p, positions_count: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAllocDialogOpen(false)}>Cancel</Button>
              <Button onClick={addAllocation} disabled={!allocForm.store_id}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
