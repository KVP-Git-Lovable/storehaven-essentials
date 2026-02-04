import { useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { toast } from "sonner";
import {
  Plus,
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
  Calculator,
  Package,
} from "lucide-react";
import { NSOStoreBudgetSection } from "@/components/nso/NSOStoreBudgetSection";
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

interface StoreChecklist {
  id: string;
  store_id: string;
  master_id: string | null;
  name: string;
  start_date: string;
  status: string;
  prescribed_budget: number | null;
  budget: number | null;
  final_budget: number | null;
  stores?: { name: string; store_size_sqft: number | null };
}

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

export default function NewStoreOpening() {
  const queryClient = useQueryClient();
  const [selectedChecklist, setSelectedChecklist] = useState<StoreChecklist | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDetailsDialogOpen, setTaskDetailsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StoreTask | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [deleteChecklistDialogOpen, setDeleteChecklistDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<StoreChecklist | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Form states
  const [assignForm, setAssignForm] = useState({
    store_id: "",
    master_id: "",
    start_date: new Date(),
  });
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

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
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

  // Fetch checklist masters
  const { data: masters = [] } = useQuery({
    queryKey: ["nso-checklist-masters-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_checklist_masters")
        .select("id, name, store_type")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch store checklists
  const { data: checklists = [] } = useQuery({
    queryKey: ["nso-store-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_checklists")
        .select("*, stores(name, store_size_sqft)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreChecklist[];
    },
  });

  // Fetch sections for selected checklist
  const { data: sections = [] } = useQuery({
    queryKey: ["nso-store-sections", selectedChecklist?.id],
    queryFn: async () => {
      if (!selectedChecklist) return [];
      const { data, error } = await supabase
        .from("nso_store_sections")
        .select("*")
        .eq("checklist_id", selectedChecklist.id)
        .order("sort_order");
      if (error) throw error;
      return data as StoreSection[];
    },
    enabled: !!selectedChecklist,
  });

  // Fetch tasks for selected checklist
  const { data: tasks = [] } = useQuery({
    queryKey: ["nso-store-tasks", selectedChecklist?.id],
    queryFn: async () => {
      if (!selectedChecklist) return [];
      const { data, error } = await supabase
        .from("nso_store_tasks")
        .select("*")
        .eq("checklist_id", selectedChecklist.id)
        .order("sort_order");
      if (error) throw error;
      return data as StoreTask[];
    },
    enabled: !!selectedChecklist,
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

  // Assign checklist mutation
  const assignChecklistMutation = useMutation({
    mutationFn: async (data: typeof assignForm) => {
      // Fetch store details for sq ft
      const { data: storeData } = await supabase
        .from("stores")
        .select("store_size_sqft")
        .eq("id", data.store_id)
        .single();
      
      // Fetch active sq ft budget rate
      const { data: sqftRate } = await supabase
        .from("sqft_budget_master")
        .select("price_per_sqft")
        .eq("status", "active")
        .order("effective_from", { ascending: false, nullsFirst: false })
        .limit(1)
        .single();
      
      // Fetch master for planned_budget
      const { data: masterData } = await supabase
        .from("nso_checklist_masters")
        .select("name, planned_budget")
        .eq("id", data.master_id)
        .single();
      
      // Calculate prescribed budget
      const storeSqft = storeData?.store_size_sqft || 0;
      const ratePerSqft = sqftRate?.price_per_sqft || 0;
      const prescribedBudget = storeSqft * ratePerSqft;
      const initialBudget = masterData?.planned_budget || 0;

      // Create the store checklist with budget fields
      const { data: checklist, error: checklistError } = await supabase
        .from("nso_store_checklists")
        .insert({
          store_id: data.store_id,
          master_id: data.master_id,
          name: masterData?.name || "New Store Opening",
          start_date: format(data.start_date, "yyyy-MM-dd"),
          prescribed_budget: prescribedBudget,
          budget: initialBudget,
          final_budget: 0,
        })
        .select()
        .single();
      if (checklistError) throw checklistError;

      // Fetch master sections and tasks
      const { data: masterSections } = await supabase
        .from("nso_master_sections")
        .select("*")
        .eq("master_id", data.master_id)
        .order("sort_order");

      if (masterSections && masterSections.length > 0) {
        for (const section of masterSections) {
          // Create store section
          const { data: storeSection, error: sectionError } = await supabase
            .from("nso_store_sections")
            .insert({
              checklist_id: checklist.id,
              name: section.name,
              sort_order: section.sort_order,
              is_custom: false,
            })
            .select()
            .single();
          if (sectionError) throw sectionError;

          // Fetch and create tasks
          const { data: masterTasks } = await supabase
            .from("nso_master_tasks")
            .select("*")
            .eq("section_id", section.id)
            .order("sort_order");

          if (masterTasks && masterTasks.length > 0) {
            let currentDate = data.start_date;
            const storeTasks = masterTasks.map((task) => {
              const startDate = currentDate;
              const endDate = addDays(startDate, task.duration_days - 1);
              currentDate = addDays(endDate, 1);
              return {
                section_id: storeSection.id,
                checklist_id: checklist.id,
                name: task.name,
                description: task.description,
                start_date: format(startDate, "yyyy-MM-dd"),
                end_date: format(endDate, "yyyy-MM-dd"),
                sort_order: task.sort_order,
                is_custom: false,
                status: "pending",
              };
            });
            await supabase.from("nso_store_tasks").insert(storeTasks);
          }
        }
      }

      // Copy required assets from master
      const { data: masterAssets } = await supabase
        .from("nso_master_assets")
        .select("*")
        .eq("master_id", data.master_id)
        .order("sort_order");

      if (masterAssets && masterAssets.length > 0) {
        const storeAssets = masterAssets.map((asset) => ({
          checklist_id: checklist.id,
          asset_master_id: asset.asset_master_id,
          quantity: asset.quantity,
          notes: asset.notes,
          sort_order: asset.sort_order,
          is_custom: false,
          status: "pending",
        }));
        await supabase.from("nso_store_assets").insert(storeAssets);
      }

      return checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-checklists"] });
      toast.success("Checklist assigned to store");
      setAssignDialogOpen(false);
      setAssignForm({ store_id: "", master_id: "", start_date: new Date() });
    },
    onError: () => toast.error("Failed to assign checklist"),
  });

  // Update checklist budget mutation
  const updateChecklistBudgetMutation = useMutation({
    mutationFn: async ({ checklistId, field, value }: { checklistId: string; field: "budget" | "final_budget"; value: number }) => {
      const { error } = await supabase
        .from("nso_store_checklists")
        .update({ [field]: value })
        .eq("id", checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-checklists"] });
      toast.success("Budget updated");
    },
    onError: () => toast.error("Failed to update budget"),
  });

  // Delete checklist mutation
  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      // Delete in order: attachments -> tasks -> sections -> checklist
      // First get all tasks to delete their attachments
      const { data: checklistTasks } = await supabase
        .from("nso_store_tasks")
        .select("id")
        .eq("checklist_id", checklistId);
      
      if (checklistTasks && checklistTasks.length > 0) {
        const taskIds = checklistTasks.map(t => t.id);
        await supabase.from("nso_task_attachments").delete().in("task_id", taskIds);
      }
      
      // Delete tasks
      await supabase.from("nso_store_tasks").delete().eq("checklist_id", checklistId);
      
      // Delete sections
      await supabase.from("nso_store_sections").delete().eq("checklist_id", checklistId);
      
      // Delete checklist
      const { error } = await supabase.from("nso_store_checklists").delete().eq("id", checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-checklists"] });
      if (selectedChecklist?.id === checklistToDelete?.id) {
        setSelectedChecklist(null);
      }
      toast.success("Checklist deleted successfully");
      setDeleteChecklistDialogOpen(false);
      setChecklistToDelete(null);
    },
    onError: () => toast.error("Failed to delete checklist"),
  });

  // Add section mutation
  const addSectionMutation = useMutation({
    mutationFn: async (data: { name: string; checklist_id: string }) => {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from("nso_store_sections").insert({
        ...data,
        sort_order: maxOrder,
        is_custom: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-sections"] });
      toast.success("Section added");
      setSectionDialogOpen(false);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to add section"),
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { section_id: string; checklist_id: string }) => {
      const sectionTasks = tasks.filter((t) => t.section_id === data.section_id);
      const maxOrder = sectionTasks.length > 0 ? Math.max(...sectionTasks.map((t) => t.sort_order)) + 1 : 0;
      const { error } = await supabase.from("nso_store_tasks").insert({
        section_id: data.section_id,
        checklist_id: data.checklist_id,
        name: data.name,
        description: data.description || null,
        owner: data.owner || null,
        start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : null,
        end_date: data.end_date ? format(data.end_date, "yyyy-MM-dd") : null,
        status: data.status,
        sort_order: maxOrder,
        is_custom: true,
        vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks"] });
      toast.success("Task added");
      setTaskDialogOpen(false);
      resetTaskForm();
    },
    onError: () => toast.error("Failed to add task"),
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (data: Partial<StoreTask> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.owner !== undefined) updateData.owner = data.owner;
      if (data.start_date !== undefined) updateData.start_date = data.start_date;
      if (data.end_date !== undefined) updateData.end_date = data.end_date;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
      if (data.section_id !== undefined) updateData.section_id = data.section_id;
      if (data.vendor_id !== undefined) updateData.vendor_id = data.vendor_id;

      const { error } = await supabase
        .from("nso_store_tasks")
        .update(updateData)
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks"] });
    },
    onError: () => toast.error("Failed to update task"),
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_store_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks"] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  // Delete section mutation
  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete tasks in section first
      await supabase.from("nso_store_tasks").delete().eq("section_id", id);
      const { error } = await supabase.from("nso_store_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-sections", "nso-store-tasks"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  // Upload attachment mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, taskId }: { file: File; taskId: string }) => {
      const fileExt = file.name.split(".").pop();
      const filePath = `${taskId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("nso-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("nso-attachments").getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("nso_task_attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: "System",
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-task-attachments"] });
      toast.success("File uploaded");
    },
    onError: () => toast.error("Failed to upload file"),
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachment: TaskAttachment) => {
      const { error } = await supabase.from("nso_task_attachments").delete().eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-task-attachments"] });
      toast.success("File deleted");
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const resetTaskForm = () => {
    setTaskForm({
      name: "",
      description: "",
      owner: "",
      start_date: null,
      end_date: null,
      status: "pending",
      vendor_id: "",
    });
    setSelectedSectionId(null);
  };

  const handleAddTask = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    resetTaskForm();
    setTaskDialogOpen(true);
  };

  const handleTaskClick = (task: StoreTask) => {
    setSelectedTask(task);
    setTaskForm({
      name: task.name,
      description: task.description || "",
      owner: task.owner || "",
      start_date: task.start_date ? new Date(task.start_date) : null,
      end_date: task.end_date ? new Date(task.end_date) : null,
      status: task.status,
      vendor_id: task.vendor_id || "",
    });
    setTaskDetailsDialogOpen(true);
  };

  const handleTaskUpdate = () => {
    if (!selectedTask) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      name: taskForm.name,
      description: taskForm.description || null,
      owner: taskForm.owner || null,
      start_date: taskForm.start_date ? format(taskForm.start_date, "yyyy-MM-dd") : null,
      end_date: taskForm.end_date ? format(taskForm.end_date, "yyyy-MM-dd") : null,
      status: taskForm.status,
      vendor_id: taskForm.vendor_id && taskForm.vendor_id !== "none" ? taskForm.vendor_id : null,
    });
    setTaskDetailsDialogOpen(false);
  };

  const handleInlineStatusChange = (taskId: string, status: string) => {
    updateTaskMutation.mutate({ id: taskId, status });
  };

  const handleGanttTaskUpdate = (taskId: string, startDate: string, endDate: string) => {
    updateTaskMutation.mutate({ id: taskId, start_date: startDate, end_date: endDate });
  };

  const handleTaskReorder = (taskId: string, newSectionId: string, newIndex: number, sectionTasks: StoreTask[]) => {
    // Reorder within the section by recalculating sort_orders
    const currentIndex = sectionTasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1 || currentIndex === newIndex) return;

    // Create new array with moved task
    const updatedTasks = [...sectionTasks];
    const [movedTask] = updatedTasks.splice(currentIndex, 1);
    updatedTasks.splice(newIndex, 0, movedTask);

    // Update sort orders for all affected tasks
    updatedTasks.forEach((task, index) => {
      if (task.sort_order !== index) {
        updateTaskMutation.mutate({ id: task.id, sort_order: index });
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedTask) return;
    for (const file of Array.from(files)) {
      await uploadAttachmentMutation.mutateAsync({ file, taskId: selectedTask.id });
    }
    e.target.value = "";
  };

  const handleDeleteChecklist = (checklist: StoreChecklist, e: React.MouseEvent) => {
    e.stopPropagation();
    setChecklistToDelete(checklist);
    setDeleteChecklistDialogOpen(true);
  };

  const confirmDeleteChecklist = () => {
    if (checklistToDelete) {
      deleteChecklistMutation.mutate(checklistToDelete.id);
    }
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find(t => t.id === active.id);
    const overTask = tasks.find(t => t.id === over.id);
    
    if (!activeTask || !overTask) return;
    
    // Only reorder within same section for now
    if (activeTask.section_id !== overTask.section_id) return;

    const sectionTasks = tasks
      .filter(t => t.section_id === activeTask.section_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    
    const oldIndex = sectionTasks.findIndex(t => t.id === active.id);
    const newIndex = sectionTasks.findIndex(t => t.id === over.id);
    
    if (oldIndex === newIndex) return;

    // Calculate new sort orders
    const updatedTasks = [...sectionTasks];
    const [movedTask] = updatedTasks.splice(oldIndex, 1);
    updatedTasks.splice(newIndex, 0, movedTask);

    // Update sort orders in database
    updatedTasks.forEach((task, index) => {
      if (task.sort_order !== index) {
        updateTaskMutation.mutate({ id: task.id, sort_order: index });
      }
    });
  };

  const getTasksForSection = (sectionId: string) => 
    tasks.filter((t) => t.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);

  const getProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  };

  const activeDragTask = activeDragId ? tasks.find(t => t.id === activeDragId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Store Opening</h1>
          <p className="text-muted-foreground">Manage store opening checklists and track progress</p>
        </div>
        <Button onClick={() => setAssignDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Checklist to Store
        </Button>
      </div>

      <div className="space-y-4">
        {/* Store Checklists Header */}
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Store Checklists</h3>
          </div>
          <div className="divide-y">
            {checklists.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No checklists yet</p>
                <p className="text-sm">Assign a checklist to a store</p>
              </div>
            ) : (
              checklists.map((checklist) => {
                const isExpanded = selectedChecklist?.id === checklist.id;
                const checklistTasks = isExpanded ? tasks : [];
                const checklistSections = isExpanded ? sections : [];
                const completedTasks = checklistTasks.filter(t => t.status === "completed").length;
                const progress = checklistTasks.length > 0 ? Math.round((completedTasks / checklistTasks.length) * 100) : 0;
                
                return (
                  <div key={checklist.id}>
                    {/* Checklist Card */}
                    <div
                      className={cn(
                        "p-4 cursor-pointer hover:bg-accent/50 transition-colors group relative",
                        isExpanded && "bg-accent"
                      )}
                      onClick={() => setSelectedChecklist(isExpanded ? null : checklist)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{checklist.stores?.name || "Unknown Store"}</h4>
                          <p className="text-sm text-muted-foreground">{checklist.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant={checklist.status === "completed" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {checklist.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Start: {format(new Date(checklist.start_date), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteChecklist(checklist, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Inline Expanded Details */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-4 space-y-4">
                        {/* Progress Card */}
                        <div className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold">{checklist.stores?.name}</h3>
                              <p className="text-sm text-muted-foreground">{checklist.name}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-primary">{progress}%</span>
                              <p className="text-xs text-muted-foreground">
                                {completedTasks} / {checklistTasks.length} tasks
                              </p>
                            </div>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        {/* Tabs for Tasks, Assets and Budget */}
                        <Tabs defaultValue="tasks" className="space-y-4">
                          <TabsList>
                            <TabsTrigger value="tasks" className="gap-2">
                              <LayoutList className="h-4 w-4" />
                              Tasks
                            </TabsTrigger>
                            <TabsTrigger value="assets" className="gap-2">
                              <Package className="h-4 w-4" />
                              Required Assets
                            </TabsTrigger>
                            <TabsTrigger value="budget" className="gap-2">
                              <Calculator className="h-4 w-4" />
                              Budget
                            </TabsTrigger>
                          </TabsList>

                          {/* Tasks Tab */}
                          <TabsContent value="tasks" className="m-0">
                            <div className="rounded-lg border bg-card">
                              <div className="p-4 border-b flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <h3 className="font-semibold">Checklist Tasks</h3>
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
                              </div>

                              <div className="p-4">
                                {checklistSections.length === 0 ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No sections yet</p>
                                  </div>
                                ) : viewMode === "gantt" ? (
                                  <NSOGanttChart
                                    sections={checklistSections}
                                    tasks={checklistTasks}
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
                                    <Accordion
                                      type="multiple"
                                      defaultValue={checklistSections.map((s) => s.id)}
                                      className="space-y-3"
                                    >
                                      {checklistSections.map((section) => {
                                        const sectionTasks = getTasksForSection(section.id);
                                        return (
                                          <AccordionItem
                                            key={section.id}
                                            value={section.id}
                                            className="border rounded-lg"
                                          >
                                            <AccordionTrigger className="px-4 hover:no-underline">
                                              <div className="flex items-center gap-3 flex-1">
                                                <span className="font-medium">{section.name}</span>
                                                <Badge variant="outline" className="ml-2">
                                                  {sectionTasks.filter((t) => t.status === "completed").length}/
                                                  {sectionTasks.length}
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
                                              <SortableContext
                                                items={sectionTasks.map(t => t.id)}
                                                strategy={verticalListSortingStrategy}
                                              >
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
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-3"
                                                onClick={() => handleAddTask(section.id)}
                                              >
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
                              </div>
                            </div>
                          </TabsContent>

                          {/* Required Assets Tab */}
                          <TabsContent value="assets" className="m-0">
                            <div className="rounded-lg border bg-card p-4">
                              <NSOStoreAssetsSection
                                checklistId={checklist.id}
                                onAssetChange={() => {
                                  queryClient.invalidateQueries({ queryKey: ["nso-budget-items", checklist.id] });
                                }}
                              />
                            </div>
                          </TabsContent>

                          {/* Budget Tab */}
                          <TabsContent value="budget" className="m-0">
                            <NSOStoreBudgetSection
                              checklistId={checklist.id}
                              storeId={checklist.store_id}
                              prescribedBudget={checklist.prescribed_budget || 0}
                              budget={checklist.budget || 0}
                              finalBudget={checklist.final_budget || 0}
                              onBudgetUpdate={(field, value) => 
                                updateChecklistBudgetMutation.mutate({
                                  checklistId: checklist.id,
                                  field,
                                  value,
                                })
                              }
                            />
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>


      {/* Delete Checklist Confirmation Dialog */}
      <AlertDialog open={deleteChecklistDialogOpen} onOpenChange={setDeleteChecklistDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the checklist "{checklistToDelete?.name}" for {checklistToDelete?.stores?.name}? 
              This will permanently delete all sections, tasks, and attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteChecklist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Checklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Checklist Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Checklist to Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Store *</Label>
              <Select
                value={assignForm.store_id}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, store_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Checklist Template *</Label>
              <Select
                value={assignForm.master_id}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, master_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {masters.map((master) => (
                    <SelectItem key={master.id} value={master.id}>
                      {master.name} {master.store_type && `(${master.store_type})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(assignForm.start_date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={assignForm.start_date}
                    onSelect={(d) => d && setAssignForm((f) => ({ ...f, start_date: d }))}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Task dates will be calculated based on this start date and task durations
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignChecklistMutation.mutate(assignForm)}
              disabled={!assignForm.store_id || !assignForm.master_id || assignChecklistMutation.isPending}
            >
              {assignChecklistMutation.isPending ? "Assigning..." : "Assign Checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                placeholder="e.g., Legal & Compliance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedChecklist &&
                addSectionMutation.mutate({
                  name: sectionForm.name,
                  checklist_id: selectedChecklist.id,
                })
              }
              disabled={!sectionForm.name.trim()}
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
            <DialogDescription>
              Add a new task to the selected section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Task Name *</Label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Obtain Trade License"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Task details and notes..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={taskForm.owner}
                  onChange={(e) => setTaskForm((f) => ({ ...f, owner: e.target.value }))}
                  placeholder="Person responsible"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={taskForm.vendor_id}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, vendor_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Vendor</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
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
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.start_date ? format(taskForm.start_date, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={taskForm.start_date || undefined}
                      onSelect={(d) => setTaskForm((f) => ({ ...f, start_date: d || null }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.end_date ? format(taskForm.end_date, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={taskForm.end_date || undefined}
                      onSelect={(d) => setTaskForm((f) => ({ ...f, end_date: d || null }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedSectionId &&
                selectedChecklist &&
                addTaskMutation.mutate({
                  ...taskForm,
                  section_id: selectedSectionId,
                  checklist_id: selectedChecklist.id,
                })
              }
              disabled={!taskForm.name.trim()}
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
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Task Name *</Label>
              <Input
                value={taskForm.name}
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Task details and notes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={taskForm.owner}
                  onChange={(e) => setTaskForm((f) => ({ ...f, owner: e.target.value }))}
                  placeholder="Person responsible"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v }))}
                >
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
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select
                value={taskForm.vendor_id}
                onValueChange={(v) => setTaskForm((f) => ({ ...f, vendor_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Vendor</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.start_date ? format(taskForm.start_date, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={taskForm.start_date || undefined}
                      onSelect={(d) => setTaskForm((f) => ({ ...f, start_date: d || null }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {taskForm.end_date ? format(taskForm.end_date, "PP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={taskForm.end_date || undefined}
                      onSelect={(d) => setTaskForm((f) => ({ ...f, end_date: d || null }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </Label>
              <div className="border rounded-lg p-4 space-y-3">
                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          {att.file_name}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteAttachmentMutation.mutate(att)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No attachments yet
                  </p>
                )}
                <div>
                  <Label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Upload files</span>
                  </Label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDetailsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTaskUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
