import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, ClipboardList, Camera, QrCode, MapPin, ListChecks, Upload, Loader2, Image } from "lucide-react";
import { TaskChecklistEditor } from "@/components/operations/TaskChecklistEditor";

type TaskCategory = 'cleaning' | 'inventory' | 'security' | 'maintenance' | 'customer_service' | 'admin';

interface TaskMasterForm {
  name: string;
  description: string;
  category: TaskCategory;
  sop_image_url: string;
  sop_video_url: string;
  estimated_duration_mins: number;
  requires_photo_evidence: boolean;
  requires_barcode_scan: boolean;
  requires_gps_verification: boolean;
  qr_code_value: string;
  baseline_photo_url: string;
}

const defaultForm: TaskMasterForm = {
  name: "",
  description: "",
  category: "cleaning",
  sop_image_url: "",
  sop_video_url: "",
  estimated_duration_mins: 15,
  requires_photo_evidence: false,
  requires_barcode_scan: false,
  requires_gps_verification: false,
  qr_code_value: "",
  baseline_photo_url: "",
};

const categoryColors: Record<TaskCategory, string> = {
  cleaning: "bg-blue-100 text-blue-800",
  inventory: "bg-green-100 text-green-800",
  security: "bg-red-100 text-red-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  customer_service: "bg-purple-100 text-purple-800",
  admin: "bg-gray-100 text-gray-800",
};

export default function TaskMaster() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskMasterForm>(defaultForm);
  const [checklistTaskId, setChecklistTaskId] = useState<string | null>(null);
  const [baselineUploading, setBaselineUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleBaselineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBaselineUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `task-baselines/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("vm-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("vm-images").getPublicUrl(filePath);
      setForm({ ...form, baseline_photo_url: publicUrl });
      toast.success("Baseline photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBaselineUploading(false);
    }
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["task-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_master")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch checklist counts for all tasks
  const { data: checklistCounts } = useQuery({
    queryKey: ["task-master-checklist-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_master_checklist_items")
        .select("task_master_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach(item => {
        counts[item.task_master_id] = (counts[item.task_master_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TaskMasterForm) => {
      const { data: result, error } = await supabase.from("task_master").insert(data).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["task-master"] });
      toast.success("Task created successfully");
      setIsDialogOpen(false);
      setForm(defaultForm);
      // Open checklist editor for the new task
      setChecklistTaskId(result.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskMasterForm }) => {
      const { error } = await supabase.from("task_master").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-master"] });
      toast.success("Task updated successfully");
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_master").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-master"] });
      queryClient.invalidateQueries({ queryKey: ["task-master-checklist-counts"] });
      toast.success("Task deleted successfully");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = () => {
    if (!form.name || !form.category) {
      toast.error("Please fill in required fields");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (task: any) => {
    setEditingId(task.id);
    setForm({
      name: task.name,
      description: task.description || "",
      category: task.category,
      sop_image_url: task.sop_image_url || "",
      sop_video_url: task.sop_video_url || "",
      estimated_duration_mins: task.estimated_duration_mins || 15,
      requires_photo_evidence: task.requires_photo_evidence || false,
      requires_barcode_scan: task.requires_barcode_scan || false,
      requires_gps_verification: task.requires_gps_verification || false,
      qr_code_value: task.qr_code_value || "",
      baseline_photo_url: task.baseline_photo_url || "",
    });
    setIsDialogOpen(true);
  };

  const filteredTasks = tasks?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Master</h1>
          <p className="text-muted-foreground">Central library of store operation tasks</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setForm(defaultForm);
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Task</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Task" : "Create New Task"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Task Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Clean Restrooms"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={(v: TaskCategory) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="customer_service">Customer Service</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed task description and instructions"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SOP Image URL</Label>
                  <Input
                    value={form.sop_image_url}
                    onChange={(e) => setForm({ ...form, sop_image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>SOP Video URL</Label>
                  <Input
                    value={form.sop_video_url}
                    onChange={(e) => setForm({ ...form, sop_video_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estimated Duration (mins)</Label>
                  <Input
                    type="number"
                    value={form.estimated_duration_mins}
                    onChange={(e) => setForm({ ...form, estimated_duration_mins: parseInt(e.target.value) || 15 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>QR Code Value (for barcode scan)</Label>
                  <Input
                    value={form.qr_code_value}
                    onChange={(e) => setForm({ ...form, qr_code_value: e.target.value })}
                    placeholder="QR-WAREHOUSE-001"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Completion Requirements</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.requires_photo_evidence}
                      onCheckedChange={(v) => setForm({ ...form, requires_photo_evidence: v })}
                    />
                    <Label className="flex items-center gap-1">
                      <Camera className="h-4 w-4" /> Photo Required
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.requires_barcode_scan}
                      onCheckedChange={(v) => setForm({ ...form, requires_barcode_scan: v })}
                    />
                    <Label className="flex items-center gap-1">
                      <QrCode className="h-4 w-4" /> Barcode Scan
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={form.requires_gps_verification}
                      onCheckedChange={(v) => setForm({ ...form, requires_gps_verification: v })}
                    />
                    <Label className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> GPS Verify
                    </Label>
                  </div>
                </div>
              </div>

              {/* Baseline Photo for Compliance */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-1.5">
                  <Image className="h-4 w-4" /> Baseline / Reference Photo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload a reference photo. When the task is executed, the user's photo will be AI-compared against this baseline.
                </p>
                {form.baseline_photo_url && (
                  <img src={form.baseline_photo_url} alt="Baseline" className="rounded-lg w-full max-h-40 object-cover border" />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="relative" type="button" disabled={baselineUploading}>
                    {baselineUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {form.baseline_photo_url ? "Replace Photo" : "Upload Photo"}
                    <input type="file" accept="image/*" onChange={handleBaselineUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </Button>
                  {form.baseline_photo_url && (
                    <Button variant="ghost" size="sm" type="button" onClick={() => setForm({ ...form, baseline_photo_url: "" })}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              </div>

              {/* Checklist editor for existing tasks */}
              {editingId && (
                <TaskChecklistEditor taskMasterId={editingId} />
              )}

              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Checklist editor dialog for newly created tasks */}
      <Dialog open={!!checklistTaskId} onOpenChange={(open) => {
        if (!open) {
          setChecklistTaskId(null);
          queryClient.invalidateQueries({ queryKey: ["task-master-checklist-counts"] });
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" /> Add Checklist Items
            </DialogTitle>
          </DialogHeader>
          {checklistTaskId && <TaskChecklistEditor taskMasterId={checklistTaskId} />}
          <Button variant="outline" onClick={() => {
            setChecklistTaskId(null);
            queryClient.invalidateQueries({ queryKey: ["task-master-checklist-counts"] });
          }}>
            Done
          </Button>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks?.map((task) => {
                  const clCount = checklistCounts?.[task.id] || 0;
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{task.name}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryColors[task.category as TaskCategory]}>
                          {task.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.estimated_duration_mins} mins</TableCell>
                      <TableCell>
                        {clCount > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-primary"
                            onClick={() => setChecklistTaskId(task.id)}
                          >
                            <ListChecks className="h-4 w-4" />
                            {clCount} items
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-muted-foreground"
                            onClick={() => setChecklistTaskId(task.id)}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {task.requires_photo_evidence && (
                            <Camera className="h-4 w-4 text-blue-500" />
                          )}
                          {task.requires_barcode_scan && (
                            <QrCode className="h-4 w-4 text-green-500" />
                          )}
                          {task.requires_gps_verification && (
                            <MapPin className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.status === "active" ? "default" : "secondary"}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(task)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
