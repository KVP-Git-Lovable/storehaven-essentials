import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarIcon,
  FolderPlus,
  ListPlus,
  Trash2,
  Paperclip,
  Upload,
  X,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutList,
  GanttChart,
  GripVertical,
  Package,
  Store,
  MapPin,
} from "lucide-react";
import { NSOStoreAssetsSection } from "@/components/nso/NSOStoreAssetsSection";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { NSOGanttChart } from "@/components/nso/NSOGanttChart";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface StoreSection {
  id: string;
  checklist_id: string;
  name: string;
  sort_order: number;
  is_custom: boolean;
}

interface StoreTask {
  id: string;
  section_id: string;
  checklist_id: string;
  name: string;
  description: string | null;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sort_order: number;
  is_custom: boolean;
  vendor_id: string | null;
}

interface Vendor {
  id: string;
  name: string;
}

interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: "bg-muted text-muted-foreground", icon: Clock, label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-800", icon: AlertCircle, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-800", icon: CheckCircle2, label: "Completed" },
  blocked: { color: "bg-red-100 text-red-800", icon: AlertCircle, label: "Blocked" },
};

// Sortable Task Row Component
function SortableTaskRow({ 
  task, 
  onTaskClick, 
  onStatusChange, 
  onDelete 
}: { 
  task: StoreTask; 
  onTaskClick: (task: StoreTask) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const StatusIcon = statusConfig[task.status]?.icon || Clock;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        isDragging && "opacity-50 bg-accent"
      )}
      onClick={() => onTaskClick(task)}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          <StatusIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{task.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{task.owner || "-"}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {task.start_date ? format(new Date(task.start_date), "MMM d") : "-"}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {task.end_date ? format(new Date(task.end_date), "MMM d") : "-"}
        </span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Select
          value={task.status}
          onValueChange={(v) => onStatusChange(task.id, v)}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function NSOChecklistDetails() {
  const { id: checklistId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDetailsDialogOpen, setTaskDetailsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StoreTask | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Form states
  const [sectionForm, setSectionForm] = useState({ name: "" });
  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    owner: "",
    start_date: null as Date | null,
    end_date: null as Date | null,
    status: "pending",
    vendor_id: "",
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch checklist details
  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: ["nso-store-checklist", checklistId],
    queryFn: async () => {
      if (!checklistId) return null;
      const { data, error } = await supabase
        .from("nso_store_checklists")
        .select("*, stores(id, name, address, store_size_sqft)")
        .eq("id", checklistId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!checklistId,
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id, name").order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Fetch sections
  const { data: sections = [] } = useQuery({
    queryKey: ["nso-store-sections", checklistId],
    queryFn: async () => {
      if (!checklistId) return [];
      const { data, error } = await supabase
        .from("nso_store_sections")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data as StoreSection[];
    },
    enabled: !!checklistId,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["nso-store-tasks", checklistId],
    queryFn: async () => {
      if (!checklistId) return [];
      const { data, error } = await supabase
        .from("nso_store_tasks")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data as StoreTask[];
    },
    enabled: !!checklistId,
  });

  // Fetch attachments for selected task
  const { data: attachments = [] } = useQuery({
    queryKey: ["nso-task-attachments", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const { data, error } = await supabase
        .from("nso_task_attachments")
        .select("*")
        .eq("task_id", selectedTask.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TaskAttachment[];
    },
    enabled: !!selectedTask,
  });

  // Mutations
  const createSectionMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!checklistId) throw new Error("No checklist selected");
      const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from("nso_store_sections").insert({
        checklist_id: checklistId,
        name,
        sort_order: maxOrder,
        is_custom: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-sections", checklistId] });
      toast.success("Section added");
      setSectionDialogOpen(false);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to add section"),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const { error } = await supabase.from("nso_store_sections").delete().eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-sections", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks", checklistId] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { section_id: string }) => {
      if (!checklistId) throw new Error("No checklist selected");
      const sectionTasks = tasks.filter((t) => t.section_id === data.section_id);
      const maxOrder = sectionTasks.length > 0 ? Math.max(...sectionTasks.map((t) => t.sort_order)) + 1 : 0;
      const { error } = await supabase.from("nso_store_tasks").insert({
        checklist_id: checklistId,
        section_id: data.section_id,
        name: data.name,
        description: data.description || null,
        owner: data.owner || null,
        start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : null,
        end_date: data.end_date ? format(data.end_date, "yyyy-MM-dd") : null,
        status: data.status,
        vendor_id: data.vendor_id || null,
        sort_order: maxOrder,
        is_custom: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks", checklistId] });
      toast.success("Task added");
      setTaskDialogOpen(false);
      setTaskForm({ name: "", description: "", owner: "", start_date: null, end_date: null, status: "pending", vendor_id: "" });
    },
    onError: () => toast.error("Failed to add task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<StoreTask>) => {
      const { id, ...updates } = data;
      const { error } = await supabase.from("nso_store_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks", checklistId] });
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("nso_store_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks", checklistId] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  // Upload attachment
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${taskId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("nso-attachments")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("nso-attachments").getPublicUrl(fileName);
      const { error: insertError } = await supabase.from("nso_task_attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        uploaded_by: "current_user",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-task-attachments", selectedTask?.id] });
      toast.success("File uploaded");
    },
    onError: () => toast.error("Failed to upload file"),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase.from("nso_task_attachments").delete().eq("id", attachmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-task-attachments", selectedTask?.id] });
      toast.success("Attachment deleted");
    },
    onError: () => toast.error("Failed to delete attachment"),
  });

  // Helpers
  const getTasksForSection = (sectionId: string) => tasks.filter((t) => t.section_id === sectionId);

  const handleTaskClick = (task: StoreTask) => {
    setSelectedTask(task);
    setTaskDetailsDialogOpen(true);
  };

  const handleAddTask = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setTaskForm({ name: "", description: "", owner: "", start_date: null, end_date: null, status: "pending", vendor_id: "" });
    setTaskDialogOpen(true);
  };

  const handleInlineStatusChange = (taskId: string, status: string) => {
    updateTaskMutation.mutate({ id: taskId, status });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedTask) {
      uploadAttachmentMutation.mutate({ taskId: selectedTask.id, file });
    }
  };

  const handleGanttTaskUpdate = (taskId: string, startDate: string, endDate: string) => {
    updateTaskMutation.mutate({ id: taskId, start_date: startDate, end_date: endDate });
  };

  const handleTaskReorder = (taskId: string, newSectionId: string, newIndex: number, sectionTasks: StoreTask[]) => {
    const updatedTasks = sectionTasks.filter((t) => t.id !== taskId);
    const taskToMove = tasks.find((t) => t.id === taskId);
    if (taskToMove) {
      updatedTasks.splice(newIndex, 0, taskToMove);
      updatedTasks.forEach((task, index) => {
        if (task.sort_order !== index || task.section_id !== newSectionId) {
          updateTaskMutation.mutate({ id: task.id, sort_order: index, section_id: newSectionId });
        }
      });
    }
  };

  // DnD handlers
  const activeDragTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    const overTask = tasks.find((t) => t.id === over.id);

    if (activeTask && overTask && activeTask.section_id === overTask.section_id) {
      const sectionTasks = [...tasks.filter((t) => t.section_id === activeTask.section_id)];
      const oldIndex = sectionTasks.findIndex((t) => t.id === active.id);
      const newIndex = sectionTasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== newIndex) {
        const [movedTask] = sectionTasks.splice(oldIndex, 1);
        sectionTasks.splice(newIndex, 0, movedTask);
        sectionTasks.forEach((task, index) => {
          if (task.sort_order !== index) {
            updateTaskMutation.mutate({ id: task.id, sort_order: index });
          }
        });
      }
    }
  };

  // Calculate progress
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  if (checklistLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Checklist not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/stores/new-opening")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to NSO
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores/new-opening")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{checklist.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Store className="h-4 w-4" />
              {checklist.stores?.name || "Unknown Store"}
            </div>
            {checklist.stores?.address && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {checklist.stores.address}
              </div>
            )}
            <Badge variant={checklist.status === "completed" ? "default" : "outline"}>
              {checklist.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Store Info & Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Store Size</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{checklist.stores?.store_size_sqft?.toLocaleString() || 0} sq ft</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{format(new Date(checklist.start_date), "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-primary">{progress}%</span>
              <span className="text-sm text-muted-foreground">
                ({completedTasks}/{tasks.length} tasks)
              </span>
            </div>
            <Progress value={progress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Tasks, Assets, Budget */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="tasks" className="gap-2">
            <LayoutList className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <Package className="h-4 w-4" />
            Required Assets
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="m-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Checklist Tasks</CardTitle>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as "list" | "gantt")}
                  className="border rounded-lg p-1"
                >
                  <ToggleGroupItem value="list" aria-label="List view" className="h-8 px-3 gap-2">
                    <LayoutList className="h-4 w-4" />
                    List
                  </ToggleGroupItem>
                  <ToggleGroupItem value="gantt" aria-label="Gantt view" className="h-8 px-3 gap-2">
                    <GanttChart className="h-4 w-4" />
                    Gantt
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSectionForm({ name: "" });
                  setSectionDialogOpen(true);
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No sections yet</p>
                </div>
              ) : viewMode === "gantt" ? (
                <NSOGanttChart
                  sections={sections}
                  tasks={tasks}
                  onTaskUpdate={handleGanttTaskUpdate}
                  onTaskClick={handleTaskClick}
                  onAddTask={handleAddTask}
                  onTaskReorder={handleTaskReorder}
                />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <Accordion type="multiple" defaultValue={sections.map((s) => s.id)} className="space-y-3">
                    {sections.map((section) => {
                      const sectionTasks = getTasksForSection(section.id);
                      return (
                        <AccordionItem key={section.id} value={section.id} className="border rounded-lg">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="font-medium">{section.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {sectionTasks.filter((t) => t.status === "completed").length}/{sectionTasks.length}
                              </Badge>
                              {section.is_custom && (
                                <Badge variant="secondary" className="text-xs">Custom</Badge>
                              )}
                            </div>
                            <div className="flex gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteSectionMutation.mutate(section.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <SortableContext items={sectionTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[250px]">Task</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[80px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sectionTasks.map((task) => (
                                    <SortableTaskRow
                                      key={task.id}
                                      task={task}
                                      onTaskClick={handleTaskClick}
                                      onStatusChange={handleInlineStatusChange}
                                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            </SortableContext>
                            <Button variant="outline" size="sm" className="mt-3" onClick={() => handleAddTask(section.id)}>
                              <ListPlus className="h-4 w-4 mr-2" />
                              Add Task
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  <DragOverlay>
                    {activeDragTask ? (
                      <div className="bg-card border rounded-lg p-2 shadow-lg flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{activeDragTask.name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Required Assets Tab */}
        <TabsContent value="assets" className="m-0">
          <Card>
            <CardContent className="pt-6">
              <NSOStoreAssetsSection
                checklistId={checklistId!}
                onAssetChange={() => {
                  queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklistId] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Add Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name *</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ name: e.target.value })}
                placeholder="e.g., Interior Setup"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSectionMutation.mutate(sectionForm.name)}
              disabled={!sectionForm.name.trim() || createSectionMutation.isPending}
            >
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Task Name *</Label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Install signage"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Task details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={taskForm.owner}
                  onChange={(e) => setTaskForm((f) => ({ ...f, owner: e.target.value }))}
                  placeholder="Responsible person"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={taskForm.vendor_id || "none"}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, vendor_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskForm.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.start_date ? format(taskForm.start_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar mode="single" selected={taskForm.start_date || undefined} onSelect={(d) => setTaskForm((f) => ({ ...f, start_date: d || null }))} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !taskForm.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.end_date ? format(taskForm.end_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar mode="single" selected={taskForm.end_date || undefined} onSelect={(d) => setTaskForm((f) => ({ ...f, end_date: d || null }))} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={taskForm.status} onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedSectionId && createTaskMutation.mutate({ ...taskForm, section_id: selectedSectionId })}
              disabled={!taskForm.name.trim() || createTaskMutation.isPending}
            >
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={taskDetailsDialogOpen} onOpenChange={setTaskDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.name}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Owner</Label>
                  <p className="font-medium">{selectedTask.owner || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusConfig[selectedTask.status]?.color}>{statusConfig[selectedTask.status]?.label}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="font-medium">{selectedTask.start_date ? format(new Date(selectedTask.start_date), "PPP") : "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">End Date</Label>
                  <p className="font-medium">{selectedTask.end_date ? format(new Date(selectedTask.end_date), "PPP") : "-"}</p>
                </div>
              </div>
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedTask.description}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({attachments.length})
                  </Label>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </span>
                    </Button>
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <FileText className="h-4 w-4" />
                          {att.file_name}
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteAttachmentMutation.mutate(att.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attachments yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
