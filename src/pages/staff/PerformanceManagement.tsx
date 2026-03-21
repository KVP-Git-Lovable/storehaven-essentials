import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Target, Star, MessageSquare, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Goal = {
  id: string; employee_id: string; review_cycle: string; goal_title: string;
  description: string | null; target_date: string | null; weightage: number;
  status: string; self_rating: number | null; self_comments: string | null;
  manager_rating: number | null; manager_comments: string | null;
  created_by: string | null; created_at: string;
  employee?: { name: string } | null;
};

type FeedbackEntry = {
  id: string; employee_id: string; review_cycle: string; feedback_type: string;
  rating: number | null; feedback_text: string | null; given_by: string | null;
  feedback_date: string; created_at: string;
  employee?: { name: string } | null;
};

const currentYear = new Date().getFullYear().toString();
const cycles = [currentYear, (parseInt(currentYear) - 1).toString(), (parseInt(currentYear) + 1).toString()];

export default function PerformanceManagement() {
  const [tab, setTab] = useState("goals");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState(currentYear);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const { toast } = useToast();

  // Goal form
  const [goalForm, setGoalForm] = useState({ employee_id: "", goal_title: "", description: "", target_date: "", weightage: "20" });
  // Feedback form
  const [fbForm, setFbForm] = useState({ employee_id: "", feedback_type: "manager", rating: "3", feedback_text: "", given_by: "" });

  useEffect(() => { fetchAll(); }, [cycleFilter]);

  const fetchAll = async () => {
    setLoading(true);
    const [gRes, fRes, eRes] = await Promise.all([
      supabase.from("performance_goals").select("*, employee:employees(name)").eq("review_cycle", cycleFilter).order("created_at", { ascending: false }),
      supabase.from("manager_feedback_entries").select("*, employee:employees(name)").eq("review_cycle", cycleFilter).order("feedback_date", { ascending: false }),
      supabase.from("employees").select("id, name").eq("status", "active").order("name"),
    ]);
    if (gRes.data) setGoals(gRes.data as any);
    if (fRes.data) setFeedbackEntries(fRes.data as any);
    if (eRes.data) setEmployees(eRes.data);
    setLoading(false);
  };

  const addGoal = async () => {
    const { error } = await supabase.from("performance_goals").insert({
      employee_id: goalForm.employee_id,
      review_cycle: cycleFilter,
      goal_title: goalForm.goal_title,
      description: goalForm.description || null,
      target_date: goalForm.target_date || null,
      weightage: parseInt(goalForm.weightage) || 0,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Goal added" });
    setGoalDialogOpen(false);
    setGoalForm({ employee_id: "", goal_title: "", description: "", target_date: "", weightage: "20" });
    fetchAll();
  };

  const addFeedback = async () => {
    const { error } = await supabase.from("manager_feedback_entries").insert({
      employee_id: fbForm.employee_id,
      review_cycle: cycleFilter,
      feedback_type: fbForm.feedback_type,
      rating: parseInt(fbForm.rating) || null,
      feedback_text: fbForm.feedback_text || null,
      given_by: fbForm.given_by || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Feedback submitted" });
    setFeedbackDialogOpen(false);
    setFbForm({ employee_id: "", feedback_type: "manager", rating: "3", feedback_text: "", given_by: "" });
    fetchAll();
  };

  const saveReview = async (type: "self" | "manager", rating: number, comments: string) => {
    if (!selectedGoal) return;
    const update = type === "self"
      ? { self_rating: rating, self_comments: comments }
      : { manager_rating: rating, manager_comments: comments };
    await supabase.from("performance_goals").update(update).eq("id", selectedGoal.id);
    toast({ title: "Review saved" });
    setReviewDialogOpen(false);
    setSelectedGoal(null);
    fetchAll();
  };

  const filteredGoals = goals.filter(g =>
    (g.employee as any)?.name?.toLowerCase().includes(search.toLowerCase()) || g.goal_title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFeedback = feedbackEntries.filter(f =>
    (f.employee as any)?.name?.toLowerCase().includes(search.toLowerCase()) || (f.feedback_text?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Performance Management</h1>
          <p className="text-muted-foreground">Goal setting, self-review, and manager feedback</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cycleFilter} onValueChange={setCycleFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{cycles.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6 flex items-center gap-3"><Target className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{goals.length}</p><p className="text-xs text-muted-foreground">Goals Set</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><Star className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{goals.filter(g => g.self_rating).length}</p><p className="text-xs text-muted-foreground">Self Reviewed</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><BarChart3 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{goals.filter(g => g.manager_rating).length}</p><p className="text-xs text-muted-foreground">Manager Reviewed</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><MessageSquare className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{feedbackEntries.length}</p><p className="text-xs text-muted-foreground">Feedback Entries</p></div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="goals">Goals & Reviews</TabsTrigger>
            <TabsTrigger value="feedback">Manager Feedback</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-[200px]" />
            </div>
            {tab === "goals" ? (
              <Button className="gap-2" onClick={() => setGoalDialogOpen(true)}><Plus className="h-4 w-4" />Add Goal</Button>
            ) : (
              <Button className="gap-2" onClick={() => setFeedbackDialogOpen(true)}><Plus className="h-4 w-4" />Add Feedback</Button>
            )}
          </div>
        </div>

        <TabsContent value="goals" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Weightage</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Self Rating</TableHead>
                  <TableHead>Manager Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGoals.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No goals found</TableCell></TableRow>
                ) : filteredGoals.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{(g.employee as any)?.name || "—"}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{g.goal_title}</p>
                        {g.description && <p className="text-xs text-muted-foreground line-clamp-1">{g.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{g.weightage}%</TableCell>
                    <TableCell>{g.target_date ? format(new Date(g.target_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>
                      {g.self_rating ? (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < g.self_rating! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Pending</span>}
                    </TableCell>
                    <TableCell>
                      {g.manager_rating ? (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < g.manager_rating! ? "text-green-500 fill-green-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Pending</span>}
                    </TableCell>
                    <TableCell><Badge variant={g.status === "active" ? "default" : "secondary"}>{g.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedGoal(g); setReviewDialogOpen(true); }}>Review</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Given By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No feedback entries</TableCell></TableRow>
                ) : filteredFeedback.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{(f.employee as any)?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{f.feedback_type}</Badge></TableCell>
                    <TableCell>
                      {f.rating && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < f.rating! ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{f.feedback_text || "—"}</TableCell>
                    <TableCell>{f.given_by || "—"}</TableCell>
                    <TableCell>{format(new Date(f.feedback_date), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Performance Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={goalForm.employee_id} onValueChange={v => setGoalForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Goal Title</Label>
              <Input value={goalForm.goal_title} onChange={e => setGoalForm(p => ({ ...p, goal_title: e.target.value }))} placeholder="e.g. Improve customer satisfaction score" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={goalForm.description} onChange={e => setGoalForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Date</Label>
                <Input type="date" value={goalForm.target_date} onChange={e => setGoalForm(p => ({ ...p, target_date: e.target.value }))} />
              </div>
              <div>
                <Label>Weightage (%)</Label>
                <Input type="number" value={goalForm.weightage} onChange={e => setGoalForm(p => ({ ...p, weightage: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
              <Button onClick={addGoal} disabled={!goalForm.employee_id || !goalForm.goal_title}>Add Goal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Feedback</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={fbForm.employee_id} onValueChange={v => setFbForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Feedback Type</Label>
              <Select value={fbForm.feedback_type} onValueChange={v => setFbForm(p => ({ ...p, feedback_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager Feedback</SelectItem>
                  <SelectItem value="self">Self Assessment</SelectItem>
                  <SelectItem value="peer">Peer Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating (1-5)</Label>
              <Select value={fbForm.rating} onValueChange={v => setFbForm(p => ({ ...p, rating: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(r => <SelectItem key={r} value={r.toString()}>{r} Star{r > 1 ? "s" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Feedback</Label>
              <Textarea value={fbForm.feedback_text} onChange={e => setFbForm(p => ({ ...p, feedback_text: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>Given By</Label>
              <Input value={fbForm.given_by} onChange={e => setFbForm(p => ({ ...p, given_by: e.target.value }))} placeholder="Manager name" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>Cancel</Button>
              <Button onClick={addFeedback} disabled={!fbForm.employee_id}>Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Goal Dialog */}
      {selectedGoal && (
        <ReviewGoalDialog
          open={reviewDialogOpen}
          onOpenChange={v => { setReviewDialogOpen(v); if (!v) setSelectedGoal(null); }}
          goal={selectedGoal}
          onSave={saveReview}
        />
      )}
    </div>
  );
}

function ReviewGoalDialog({ open, onOpenChange, goal, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; goal: Goal;
  onSave: (type: "self" | "manager", rating: number, comments: string) => void;
}) {
  const [reviewType, setReviewType] = useState<"self" | "manager">("self");
  const [rating, setRating] = useState(goal.self_rating || 3);
  const [comments, setComments] = useState(goal.self_comments || "");

  useEffect(() => {
    if (reviewType === "self") {
      setRating(goal.self_rating || 3);
      setComments(goal.self_comments || "");
    } else {
      setRating(goal.manager_rating || 3);
      setComments(goal.manager_comments || "");
    }
  }, [reviewType, goal]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Review: {goal.goal_title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Review Type</Label>
            <Select value={reviewType} onValueChange={v => setReviewType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Self Review</SelectItem>
                <SelectItem value="manager">Manager Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setRating(i + 1)}>
                  <Star className={`h-6 w-6 cursor-pointer ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onSave(reviewType, rating, comments)}>Save Review</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
