import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, ListChecks, Clock, Settings, ChevronRight } from "lucide-react";

type TimeWindow = 'opening' | 'periodic' | 'closing' | 'anytime';

interface TemplateItemForm {
  task_id: string;
  role_id: string;
  frequency_id: string;
  time_window: TimeWindow;
  time_offset_mins: number;
  periodic_interval_mins: number | null;
  is_mandatory: boolean;
  priority: number;
}

export default function TaskTemplates() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "", store_id: "", is_default: false });
  const [itemForm, setItemForm] = useState<TemplateItemForm>({
    task_id: "",
    role_id: "",
    frequency_id: "",
    time_window: "anytime",
    time_offset_mins: 0,
    periodic_interval_mins: null,
    is_mandatory: true,
    priority: 5,
  });
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_template")
        .select("*, stores(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["task-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_master").select("id, name, category").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["role-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_master").select("id, name, shift_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: frequencies } = useQuery({
    queryKey: ["frequency-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("frequency_master").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: templateItems } = useQuery({
    queryKey: ["template-items", selectedTemplate?.id],
    queryFn: async () => {
      if (!selectedTemplate?.id) return [];
      const { data, error } = await supabase
        .from("task_template_items")
        .select("*, task_master(name, category), role_master(name, shift_type), frequency_master(name)")
        .eq("template_id", selectedTemplate.id)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTemplate?.id,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      const insertData: any = { name: data.name, description: data.description, is_default: data.is_default };
      if (data.store_id) insertData.store_id = data.store_id;
      const { error } = await supabase.from("task_template").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Template created successfully");
      setIsDialogOpen(false);
      setTemplateForm({ name: "", description: "", store_id: "", is_default: false });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_template").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast.success("Template deleted successfully");
      if (selectedTemplate?.id === editingId) setSelectedTemplate(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: TemplateItemForm) => {
      const { error } = await supabase.from("task_template_items").insert({
        template_id: selectedTemplate.id,
        ...data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-items", selectedTemplate?.id] });
      toast.success("Task added to template");
      setIsItemDialogOpen(false);
      setItemForm({
        task_id: "",
        role_id: "",
        frequency_id: "",
        time_window: "anytime",
        time_offset_mins: 0,
        periodic_interval_mins: null,
        is_mandatory: true,
        priority: 5,
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-items", selectedTemplate?.id] });
      toast.success("Task removed from template");
    },
    onError: (error) => toast.error(error.message),
  });

  const timeWindowColors: Record<TimeWindow, string> = {
    opening: "bg-green-100 text-green-800",
    periodic: "bg-blue-100 text-blue-800",
    closing: "bg-orange-100 text-orange-800",
    anytime: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Templates</h1>
          <p className="text-muted-foreground">Create task "playlists" for stores</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task Template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g., Standard Daily Operations"
                />
              </div>
              <div className="space-y-2">
                <Label>Store (Optional - leave empty for global template)</Label>
                <Select value={templateForm.store_id || "_all"} onValueChange={(v) => setTemplateForm({ ...templateForm, store_id: v === "_all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All stores (Global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All stores (Global)</SelectItem>
                    {stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="Template description"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={templateForm.is_default}
                  onCheckedChange={(v) => setTemplateForm({ ...templateForm, is_default: v })}
                />
                <Label>Set as default template</Label>
              </div>
              <Button onClick={() => createTemplateMutation.mutate(templateForm)} className="w-full">
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Templates</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-center py-4">Loading...</div>
            ) : (
              templates
                ?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
                .map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {template.stores?.name || "All stores"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {template.is_default && <Badge variant="secondary">Default</Badge>}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedTemplate ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selectedTemplate.name}</CardTitle>
                  <CardDescription>{selectedTemplate.description || "No description"}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Task</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Task to Template</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Task *</Label>
                          <Select value={itemForm.task_id} onValueChange={(v) => setItemForm({ ...itemForm, task_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                            <SelectContent>
                              {tasks?.map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                  {task.name} ({task.category})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Assigned Role *</Label>
                            <Select value={itemForm.role_id} onValueChange={(v) => setItemForm({ ...itemForm, role_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                              <SelectContent>
                                {roles?.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Frequency *</Label>
                            <Select value={itemForm.frequency_id} onValueChange={(v) => setItemForm({ ...itemForm, frequency_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                              <SelectContent>
                                {frequencies?.map((freq) => (
                                  <SelectItem key={freq.id} value={freq.id}>{freq.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Time Window</Label>
                            <Select value={itemForm.time_window} onValueChange={(v: TimeWindow) => setItemForm({ ...itemForm, time_window: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="opening">Opening (after store opens)</SelectItem>
                                <SelectItem value="periodic">Periodic (repeating)</SelectItem>
                                <SelectItem value="closing">Closing (before close)</SelectItem>
                                <SelectItem value="anytime">Anytime</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Priority (1-10)</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={itemForm.priority}
                              onChange={(e) => setItemForm({ ...itemForm, priority: parseInt(e.target.value) || 5 })}
                            />
                          </div>
                        </div>
                        {itemForm.time_window === "periodic" && (
                          <div className="space-y-2">
                            <Label>Repeat every (minutes)</Label>
                            <Input
                              type="number"
                              value={itemForm.periodic_interval_mins || ""}
                              onChange={(e) => setItemForm({ ...itemForm, periodic_interval_mins: parseInt(e.target.value) || null })}
                              placeholder="e.g., 120 for every 2 hours"
                            />
                          </div>
                        )}
                        {(itemForm.time_window === "opening" || itemForm.time_window === "closing") && (
                          <div className="space-y-2">
                            <Label>Time offset (minutes from {itemForm.time_window === "opening" ? "open" : "close"})</Label>
                            <Input
                              type="number"
                              value={itemForm.time_offset_mins}
                              onChange={(e) => setItemForm({ ...itemForm, time_offset_mins: parseInt(e.target.value) || 0 })}
                              placeholder="e.g., 30 for 30 mins after open"
                            />
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={itemForm.is_mandatory}
                            onCheckedChange={(v) => setItemForm({ ...itemForm, is_mandatory: v })}
                          />
                          <Label>Mandatory task</Label>
                        </div>
                        <Button onClick={() => addItemMutation.mutate(itemForm)} className="w-full">
                          Add Task
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteTemplateMutation.mutate(selectedTemplate.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Time Window</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateItems?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.task_master?.name}</div>
                            <div className="text-xs text-muted-foreground">{item.task_master?.category}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.role_master?.name}
                            <div className="text-xs text-muted-foreground capitalize">
                              {item.role_master?.shift_type} shift
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.frequency_master?.name}</TableCell>
                        <TableCell>
                          <Badge className={timeWindowColors[item.time_window as TimeWindow]}>
                            {item.time_window}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.priority}</Badge>
                          {item.is_mandatory && <Badge className="ml-1">Required</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deleteItemMutation.mutate(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!templateItems || templateItems.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No tasks in this template. Click "Add Task" to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
              <div className="text-center">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a template to view and manage tasks</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
