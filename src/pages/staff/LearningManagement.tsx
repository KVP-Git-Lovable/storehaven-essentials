import { useState, useEffect } from "react";
import { Plus, Search, Loader2, BookOpen, GraduationCap, CheckCircle, ChevronRight, Trash2, Play } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type LearningPath = {
  id: string; name: string; description: string | null; status: string;
  created_at: string; trails?: Trail[];
  roles?: { role_name: string }[];
  enrollments?: { id: string }[];
};
type Trail = {
  id: string; name: string; description: string | null; sort_order: number;
  modules?: LModule[];
};
type LModule = {
  id: string; title: string; content_type: string; content_url: string | null;
  content_text: string | null; duration_minutes: number; sort_order: number;
  questions?: Question[];
};
type Question = {
  id: string; question: string; options: string[]; correct_answer: number; sort_order: number;
};
type Enrollment = {
  id: string; learning_path_id: string; employee_id: string;
  status: string; progress_percent: number; enrolled_at: string;
  employee?: { name: string } | null;
  learning_path?: { name: string } | null;
};

export default function LearningManagement() {
  const [tab, setTab] = useState("paths");
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [detailPath, setDetailPath] = useState<LearningPath | null>(null);
  const [trailDialogOpen, setTrailDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const { toast } = useToast();

  // Forms
  const [pathForm, setPathForm] = useState({ name: "", description: "", roles: "" });
  const [trailForm, setTrailForm] = useState({ name: "", description: "" });
  const [moduleForm, setModuleForm] = useState({ title: "", content_type: "document", content_url: "", content_text: "", duration_minutes: "15" });
  const [questionForm, setQuestionForm] = useState({ question: "", option1: "", option2: "", option3: "", option4: "", correct_answer: "0" });
  const [enrollForm, setEnrollForm] = useState({ path_id: "", employee_id: "" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, eRes, empRes] = await Promise.all([
      supabase.from("learning_paths").select("*, learning_path_roles(role_name), learning_enrollments(id)").order("created_at", { ascending: false }),
      supabase.from("learning_enrollments").select("*, employee:employees(name), learning_path:learning_paths(name)").order("enrolled_at", { ascending: false }),
      supabase.from("employees").select("id, name").eq("status", "active").order("name"),
    ]);
    if (pRes.data) setPaths(pRes.data as any);
    if (eRes.data) setEnrollments(eRes.data as any);
    if (empRes.data) setEmployees(empRes.data);
    setLoading(false);
  };

  const fetchPathDetail = async (pathId: string) => {
    const { data } = await supabase
      .from("learning_paths")
      .select("*, learning_path_roles(role_name), learning_path_trails(*, learning_modules(*, learning_module_questions(*)))")
      .eq("id", pathId)
      .single();
    if (data) setDetailPath(data as any);
  };

  const createPath = async () => {
    const { data, error } = await supabase.from("learning_paths").insert({ name: pathForm.name, description: pathForm.description || null }).select().single();
    if (error || !data) { toast({ title: "Error", variant: "destructive" }); return; }
    // Add roles
    const roles = pathForm.roles.split(",").map(r => r.trim()).filter(Boolean);
    if (roles.length) {
      await supabase.from("learning_path_roles").insert(roles.map(r => ({ learning_path_id: data.id, role_name: r })));
    }
    toast({ title: "Learning path created" });
    setPathDialogOpen(false);
    setPathForm({ name: "", description: "", roles: "" });
    fetchAll();
  };

  const addTrail = async () => {
    if (!detailPath) return;
    const sortOrder = (detailPath.trails?.length || 0) + 1;
    await supabase.from("learning_path_trails").insert({
      learning_path_id: detailPath.id, name: trailForm.name, description: trailForm.description || null, sort_order: sortOrder,
    });
    toast({ title: "Trail added" });
    setTrailDialogOpen(false);
    setTrailForm({ name: "", description: "" });
    fetchPathDetail(detailPath.id);
  };

  const addModule = async () => {
    if (!selectedTrailId || !detailPath) return;
    const trail = detailPath.trails?.find(t => t.id === selectedTrailId);
    const sortOrder = (trail?.modules?.length || 0) + 1;
    await supabase.from("learning_modules").insert({
      trail_id: selectedTrailId, title: moduleForm.title, content_type: moduleForm.content_type,
      content_url: moduleForm.content_url || null, content_text: moduleForm.content_text || null,
      duration_minutes: parseInt(moduleForm.duration_minutes) || 15, sort_order: sortOrder,
    });
    toast({ title: "Module added" });
    setModuleDialogOpen(false);
    setModuleForm({ title: "", content_type: "document", content_url: "", content_text: "", duration_minutes: "15" });
    fetchPathDetail(detailPath.id);
  };

  const addQuestion = async () => {
    if (!selectedModuleId || !detailPath) return;
    const options = [questionForm.option1, questionForm.option2, questionForm.option3, questionForm.option4].filter(Boolean);
    await supabase.from("learning_module_questions").insert({
      module_id: selectedModuleId, question: questionForm.question,
      options: JSON.stringify(options), correct_answer: parseInt(questionForm.correct_answer),
    });
    toast({ title: "Question added" });
    setQuestionDialogOpen(false);
    setQuestionForm({ question: "", option1: "", option2: "", option3: "", option4: "", correct_answer: "0" });
    fetchPathDetail(detailPath.id);
  };

  const enrollEmployee = async () => {
    const { error } = await supabase.from("learning_enrollments").insert({
      learning_path_id: enrollForm.path_id, employee_id: enrollForm.employee_id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Employee enrolled" });
    setEnrollDialogOpen(false);
    setEnrollForm({ path_id: "", employee_id: "" });
    fetchAll();
  };

  const publishPath = async (pathId: string) => {
    await supabase.from("learning_paths").update({ status: "published" }).eq("id", pathId);
    toast({ title: "Path published" });
    fetchAll();
  };

  const filteredPaths = paths.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  // Detail view
  if (detailPath) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDetailPath(null)}>← Back</Button>
          <h1 className="text-2xl font-semibold">{detailPath.name}</h1>
          <Badge variant={detailPath.status === "published" ? "default" : "secondary"}>{detailPath.status}</Badge>
        </div>
        {detailPath.description && <p className="text-muted-foreground">{detailPath.description}</p>}
        {(detailPath as any).learning_path_roles?.length > 0 && (
          <div className="flex gap-1">{(detailPath as any).learning_path_roles.map((r: any) => <Badge key={r.role_name} variant="outline">{r.role_name}</Badge>)}</div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Learning Trails</h2>
          <Button size="sm" onClick={() => setTrailDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Trail</Button>
        </div>

        {!(detailPath as any).learning_path_trails?.length ? (
          <p className="text-muted-foreground text-sm">No trails yet. Add trails to organize learning modules.</p>
        ) : (
          <div className="space-y-4">
            {((detailPath as any).learning_path_trails as Trail[])?.sort((a, b) => a.sort_order - b.sort_order).map((trail) => (
              <Card key={trail.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {trail.name}
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTrailId(trail.id); setModuleDialogOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Module
                    </Button>
                  </div>
                  {trail.description && <p className="text-xs text-muted-foreground">{trail.description}</p>}
                </CardHeader>
                <CardContent>
                  {!(trail as any).learning_modules?.length ? (
                    <p className="text-sm text-muted-foreground">No modules yet</p>
                  ) : (
                    <div className="space-y-2">
                      {((trail as any).learning_modules as LModule[])?.sort((a, b) => a.sort_order - b.sort_order).map((mod, idx) => (
                        <div key={mod.id} className="flex items-center justify-between p-2 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                            <div>
                              <p className="text-sm font-medium">{mod.title}</p>
                              <p className="text-xs text-muted-foreground">{mod.content_type} · {mod.duration_minutes} min</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {((mod as any).learning_module_questions as Question[])?.length || 0} Q
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedModuleId(mod.id); setQuestionDialogOpen(true); }}>
                              <Plus className="h-3 w-3 mr-1" />Quiz
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trail Dialog */}
        <Dialog open={trailDialogOpen} onOpenChange={setTrailDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Learning Trail</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Trail Name</Label><Input value={trailForm.name} onChange={e => setTrailForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fundamentals" /></div>
              <div><Label>Description</Label><Textarea value={trailForm.description} onChange={e => setTrailForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTrailDialogOpen(false)}>Cancel</Button>
                <Button onClick={addTrail} disabled={!trailForm.name}>Add Trail</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Module Dialog */}
        <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Learning Module</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div>
                <Label>Content Type</Label>
                <Select value={moduleForm.content_type} onValueChange={v => setModuleForm(p => ({ ...p, content_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="link">External Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Content URL</Label><Input value={moduleForm.content_url} onChange={e => setModuleForm(p => ({ ...p, content_url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>Content Notes</Label><Textarea value={moduleForm.content_text} onChange={e => setModuleForm(p => ({ ...p, content_text: e.target.value }))} rows={2} /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={moduleForm.duration_minutes} onChange={e => setModuleForm(p => ({ ...p, duration_minutes: e.target.value }))} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancel</Button>
                <Button onClick={addModule} disabled={!moduleForm.title}>Add Module</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Question Dialog */}
        <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Quiz Question</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Question</Label><Textarea value={questionForm.question} onChange={e => setQuestionForm(p => ({ ...p, question: e.target.value }))} rows={2} /></div>
              <div><Label>Option 1</Label><Input value={questionForm.option1} onChange={e => setQuestionForm(p => ({ ...p, option1: e.target.value }))} /></div>
              <div><Label>Option 2</Label><Input value={questionForm.option2} onChange={e => setQuestionForm(p => ({ ...p, option2: e.target.value }))} /></div>
              <div><Label>Option 3</Label><Input value={questionForm.option3} onChange={e => setQuestionForm(p => ({ ...p, option3: e.target.value }))} /></div>
              <div><Label>Option 4</Label><Input value={questionForm.option4} onChange={e => setQuestionForm(p => ({ ...p, option4: e.target.value }))} /></div>
              <div>
                <Label>Correct Answer</Label>
                <Select value={questionForm.correct_answer} onValueChange={v => setQuestionForm(p => ({ ...p, correct_answer: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Option 1</SelectItem>
                    <SelectItem value="1">Option 2</SelectItem>
                    <SelectItem value="2">Option 3</SelectItem>
                    <SelectItem value="3">Option 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancel</Button>
                <Button onClick={addQuestion} disabled={!questionForm.question}>Add Question</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Learning Management</h1>
          <p className="text-muted-foreground">Create learning paths, assign to roles, track completion</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 flex items-center gap-3"><BookOpen className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{paths.length}</p><p className="text-xs text-muted-foreground">Learning Paths</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><GraduationCap className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{enrollments.length}</p><p className="text-xs text-muted-foreground">Enrollments</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><CheckCircle className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{enrollments.filter(e => e.status === "completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="paths">Learning Paths</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-[200px]" />
            </div>
            {tab === "paths" ? (
              <Button className="gap-2" onClick={() => setPathDialogOpen(true)}><Plus className="h-4 w-4" />Create Path</Button>
            ) : (
              <Button className="gap-2" onClick={() => setEnrollDialogOpen(true)}><Plus className="h-4 w-4" />Enroll Employee</Button>
            )}
          </div>
        </div>

        <TabsContent value="paths" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPaths.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">No learning paths yet</p>
            ) : filteredPaths.map(p => (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchPathDetail(p.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Badge variant={p.status === "published" ? "default" : "secondary"} className="w-fit">{p.status}</Badge>
                </CardHeader>
                <CardContent>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{p.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(p as any).learning_path_roles?.length > 0 && (
                      <span>{(p as any).learning_path_roles.map((r: any) => r.role_name).join(", ")}</span>
                    )}
                    <span>{(p as any).learning_enrollments?.length || 0} enrolled</span>
                  </div>
                  {p.status === "draft" && (
                    <Button size="sm" variant="outline" className="mt-3" onClick={(e) => { e.stopPropagation(); publishPath(p.id); }}>
                      <Play className="h-3 w-3 mr-1" />Publish
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Learning Path</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrolled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No enrollments</TableCell></TableRow>
                ) : enrollments.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{(e.employee as any)?.name || "—"}</TableCell>
                    <TableCell>{(e.learning_path as any)?.name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={e.progress_percent} className="w-20 h-2" />
                        <span className="text-xs">{e.progress_percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={e.status === "completed" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(e.enrolled_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Path Dialog */}
      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Learning Path</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Path Name</Label><Input value={pathForm.name} onChange={e => setPathForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. New Hire Onboarding" /></div>
            <div><Label>Description</Label><Textarea value={pathForm.description} onChange={e => setPathForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>Applicable Roles (comma separated)</Label><Input value={pathForm.roles} onChange={e => setPathForm(p => ({ ...p, roles: e.target.value }))} placeholder="e.g. Cashier, Store Manager" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPathDialogOpen(false)}>Cancel</Button>
              <Button onClick={createPath} disabled={!pathForm.name}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll Employee</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Learning Path</Label>
              <Select value={enrollForm.path_id} onValueChange={v => setEnrollForm(p => ({ ...p, path_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select path" /></SelectTrigger>
                <SelectContent>{paths.filter(p => p.status === "published").map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select value={enrollForm.employee_id} onValueChange={v => setEnrollForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>Cancel</Button>
              <Button onClick={enrollEmployee} disabled={!enrollForm.path_id || !enrollForm.employee_id}>Enroll</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
