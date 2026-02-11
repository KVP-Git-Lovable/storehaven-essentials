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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarIcon,
  FolderPlus,
  ListPlus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutList,
  GanttChart,
  GripVertical,
  Package,
  Store,
  MapPin,
  Wallet,
  Filter,
  X,
  Pencil,
} from "lucide-react";
import { NSOStoreAssetsSection } from "@/components/nso/NSOStoreAssetsSection";
import { NSOTaskAttachments } from "@/components/nso/NSOTaskAttachments";
import { NSOStoreBudgetSection } from "@/components/nso/NSOStoreBudgetSection";
import { format, addDays, isPast, parseISO, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
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


const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  open: { color: "bg-muted text-muted-foreground", icon: Clock, label: "Open" },
  completed: { color: "bg-green-100 text-green-800", icon: CheckCircle2, label: "Completed" },
  cancelled: { color: "bg-gray-100 text-gray-500", icon: Clock, label: "Cancelled" },
  overdue: { color: "bg-red-100 text-red-800", icon: AlertCircle, label: "Overdue" },
};

// Manual statuses that users can select
const MANUAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// Compute effective status: auto-applies "overdue" when end_date is past and status is not completed/cancelled
function getEffectiveStatus(task: StoreTask): string {
  if (task.status === "completed" || task.status === "cancelled") {
    return task.status;
  }
  if (task.end_date) {
    const endDate = startOfDay(parseISO(task.end_date));
    const today = startOfDay(new Date());
    if (today > endDate) {
      return "overdue";
    }
  }
  // Map legacy statuses to "open"
  if (task.status === "pending" || task.status === "in_progress" || task.status === "blocked") {
    return "open";
  }
  return task.status;
}

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

  const effectiveStatus = getEffectiveStatus(task);
  const StatusIcon = statusConfig[effectiveStatus]?.icon || Clock;
  const statusStyle = statusConfig[effectiveStatus];

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
          <StatusIcon className={cn("h-4 w-4", effectiveStatus === "overdue" ? "text-destructive" : "text-muted-foreground")} />
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
        {effectiveStatus === "overdue" ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>
            <Select
              value={task.status}
              onValueChange={(v) => onStatusChange(task.id, v)}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Select
            value={task.status === "pending" || task.status === "in_progress" || task.status === "blocked" ? "open" : task.status}
            onValueChange={(v) => onStatusChange(task.id, v)}
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [ganttTimeFilter, setGanttTimeFilter] = useState<"all" | "day" | "week" | "month">("all");
  const [listTimeFilter, setListTimeFilter] = useState<"all" | "day" | "week" | "month">("all");
  const [isEditingTask, setIsEditingTask] = useState(false);

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
  // Edit form state for task details dialog
  const [editTaskForm, setEditTaskForm] = useState({
    name: "",
    description: "",
    owner: "",
    start_date: null as Date | null,
    end_date: null as Date | null,
    status: "open",
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

      // Auto-calculate dates if not manually provided
      let startDate = data.start_date ? format(data.start_date, "yyyy-MM-dd") : null;
      let endDate = data.end_date ? format(data.end_date, "yyyy-MM-dd") : null;

      if (!startDate) {
        // Find the latest end_date across ALL tasks in this checklist
        const allEndDates = tasks
          .filter((t) => t.end_date)
          .map((t) => t.end_date as string)
          .sort();
        
        if (allEndDates.length > 0) {
          const latestEndDate = parseISO(allEndDates[allEndDates.length - 1]);
          const calculatedStart = addDays(latestEndDate, 1);
          startDate = format(calculatedStart, "yyyy-MM-dd");
          if (!endDate) {
            endDate = startDate; // Default 1-day duration
          }
        } else if (checklist?.start_date) {
          startDate = checklist.start_date;
          if (!endDate) {
            endDate = startDate;
          }
        }
      }

      const { error } = await supabase.from("nso_store_tasks").insert({
        checklist_id: checklistId,
        section_id: data.section_id,
        name: data.name,
        description: data.description || null,
        owner: data.owner || null,
        start_date: startDate,
        end_date: endDate,
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
      setTaskForm({ name: "", description: "", owner: "", start_date: null, end_date: null, status: "open", vendor_id: "" });
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


  // Helpers
  const getTasksForSection = (sectionId: string) => tasks.filter((t) => t.section_id === sectionId);

  const handleTaskClick = (task: StoreTask) => {
    setSelectedTask(task);
    setIsEditingTask(false);
    setEditTaskForm({
      name: task.name,
      description: task.description || "",
      owner: task.owner || "",
      start_date: task.start_date ? parseISO(task.start_date) : null,
      end_date: task.end_date ? parseISO(task.end_date) : null,
      status: task.status === "pending" || task.status === "in_progress" || task.status === "blocked" ? "open" : task.status,
      vendor_id: task.vendor_id || "",
    });
    setTaskDetailsDialogOpen(true);
  };

  const handleSaveEditTask = () => {
    if (!selectedTask) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      name: editTaskForm.name,
      description: editTaskForm.description || null,
      owner: editTaskForm.owner || null,
      start_date: editTaskForm.start_date ? format(editTaskForm.start_date, "yyyy-MM-dd") : null,
      end_date: editTaskForm.end_date ? format(editTaskForm.end_date, "yyyy-MM-dd") : null,
      status: editTaskForm.status,
      vendor_id: editTaskForm.vendor_id || null,
    } as any);
    setSelectedTask({
      ...selectedTask,
      name: editTaskForm.name,
      description: editTaskForm.description || null,
      owner: editTaskForm.owner || null,
      start_date: editTaskForm.start_date ? format(editTaskForm.start_date, "yyyy-MM-dd") : null,
      end_date: editTaskForm.end_date ? format(editTaskForm.end_date, "yyyy-MM-dd") : null,
      status: editTaskForm.status,
      vendor_id: editTaskForm.vendor_id || null,
    });
    setIsEditingTask(false);
    toast.success("Task updated");
  };

  const handleAddTask = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    
    // Pre-populate dates based on sequential chain
    let preStartDate: Date | null = null;
    let preEndDate: Date | null = null;
    
    const allEndDates = tasks
      .filter((t) => t.end_date)
      .map((t) => t.end_date as string)
      .sort();
    
    if (allEndDates.length > 0) {
      const latestEndDate = parseISO(allEndDates[allEndDates.length - 1]);
      preStartDate = addDays(latestEndDate, 1);
      preEndDate = preStartDate; // Default 1-day duration
    } else if (checklist?.start_date) {
      preStartDate = parseISO(checklist.start_date);
      preEndDate = preStartDate;
    }

    setTaskForm({ name: "", description: "", owner: "", start_date: preStartDate, end_date: preEndDate, status: "open", vendor_id: "" });
    setTaskDialogOpen(true);
  };

  const handleInlineStatusChange = (taskId: string, status: string) => {
    updateTaskMutation.mutate({ id: taskId, status });
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

  // Calculate progress (exclude cancelled tasks from total)
  const activeTasks = tasks.filter((t) => t.status !== "cancelled");
  const completedTasks = activeTasks.filter((t) => t.status === "completed").length;
  const progress = activeTasks.length > 0 ? Math.round((completedTasks / activeTasks.length) * 100) : 0;

  // Filtered tasks for list view (status filter + time filter)
  const filteredListTasks = (() => {
    let result = statusFilter
      ? tasks.filter((t) => getEffectiveStatus(t) === statusFilter)
      : tasks;
    if (listTimeFilter !== "all") {
      const today = startOfDay(new Date());
      let rangeStart: Date;
      let rangeEnd: Date;
      if (listTimeFilter === "day") {
        rangeStart = today;
        rangeEnd = today;
      } else if (listTimeFilter === "week") {
        rangeStart = startOfWeek(today, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(today, { weekStartsOn: 1 });
      } else {
        rangeStart = startOfMonth(today);
        rangeEnd = endOfMonth(today);
      }
      result = result.filter((t) => {
        if (!t.start_date && !t.end_date) return false;
        const tStart = t.start_date ? startOfDay(parseISO(t.start_date)) : null;
        const tEnd = t.end_date ? startOfDay(parseISO(t.end_date)) : null;
        const effectiveStart = tStart || tEnd!;
        const effectiveEnd = tEnd || tStart!;
        return effectiveStart <= rangeEnd && effectiveEnd >= rangeStart;
      });
    }
    return result;
  })();

  // Filtered tasks for gantt view (time filter)
  const filteredGanttTasks = (() => {
    if (ganttTimeFilter === "all") return tasks;
    const today = startOfDay(new Date());
    let rangeStart: Date;
    let rangeEnd: Date;
    if (ganttTimeFilter === "day") {
      rangeStart = today;
      rangeEnd = today;
    } else if (ganttTimeFilter === "week") {
      rangeStart = startOfWeek(today, { weekStartsOn: 1 });
      rangeEnd = endOfWeek(today, { weekStartsOn: 1 });
    } else {
      rangeStart = startOfMonth(today);
      rangeEnd = endOfMonth(today);
    }
    return tasks.filter((t) => {
      if (!t.start_date && !t.end_date) return false;
      const tStart = t.start_date ? startOfDay(parseISO(t.start_date)) : null;
      const tEnd = t.end_date ? startOfDay(parseISO(t.end_date)) : null;
      const effectiveStart = tStart || tEnd!;
      const effectiveEnd = tEnd || tStart!;
      return effectiveStart <= rangeEnd && effectiveEnd >= rangeStart;
    });
  })();

  // Filter sections for gantt view to hide empty ones when a time filter is active
  const filteredGanttSections = ganttTimeFilter === "all"
    ? sections
    : sections.filter((s) => filteredGanttTasks.some((t) => t.section_id === s.id));

  // Calculate end date from tasks (latest end_date) and identify the task
  const endDateInfo = tasks.reduce((result: { date: Date | null; taskName: string | null }, task) => {
    if (!task.end_date) return result;
    const taskDate = new Date(task.end_date);
    if (!result.date || taskDate > result.date) {
      return { date: taskDate, taskName: task.name };
    }
    return result;
  }, { date: null, taskName: null });

  const calculatedEndDate = endDateInfo.date;
  const endDateTaskName = endDateInfo.taskName;

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
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate("/stores/new-opening")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold truncate">{checklist.name}</h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Store className="h-3 w-3 md:h-4 md:w-4" />
              <span className="truncate">{checklist.stores?.name || "Unknown Store"}</span>
            </div>
            {checklist.stores?.address && (
              <div className="flex items-center gap-1 hidden sm:flex">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{checklist.stores.address}</span>
              </div>
            )}
            <Badge variant={checklist.status === "completed" ? "default" : "outline"} className="text-xs">
              {checklist.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Store Info & Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{format(new Date(checklist.start_date), "MMM d, yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">End Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl md:text-2xl font-bold">
              {calculatedEndDate ? format(calculatedEndDate, "MMM d, yyyy") : "-"}
            </p>
            {endDateTaskName && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={endDateTaskName}>
                Based on: {endDateTaskName}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{progress}%</span>
              <span className="text-sm text-muted-foreground">
                ({completedTasks}/{activeTasks.length} tasks)
              </span>
            </div>
            <Progress value={progress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Tasks, Assets, Budget */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
          <TabsTrigger value="tasks" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-1.5 sm:px-3 py-1.5">
            <LayoutList className="h-3.5 w-3.5 hidden sm:block" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-1.5 sm:px-3 py-1.5">
            <Package className="h-3.5 w-3.5 hidden sm:block" />
            <span className="sm:hidden">Assets</span>
            <span className="hidden sm:inline">Required Assets</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-1.5 sm:px-3 py-1.5">
            <Wallet className="h-3.5 w-3.5 hidden sm:block" />
            Budget
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="m-0">
          <Card>
            <CardHeader className="flex flex-col gap-2 py-2 sm:py-4 px-3 sm:px-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap w-full md:w-auto">
                <CardTitle className="text-sm sm:text-base md:text-lg whitespace-nowrap">Checklist Tasks</CardTitle>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as "list" | "gantt")}
                  className="border rounded-lg p-0.5 sm:p-1"
                >
                  <ToggleGroupItem value="list" aria-label="List view" className="h-6 sm:h-7 md:h-8 px-1.5 sm:px-2 md:px-3 gap-1 text-[11px] sm:text-xs md:text-sm">
                    <LayoutList className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    List
                  </ToggleGroupItem>
                  <ToggleGroupItem value="gantt" aria-label="Gantt view" className="h-6 sm:h-7 md:h-8 px-1.5 sm:px-2 md:px-3 gap-1 text-[11px] sm:text-xs md:text-sm">
                    <GanttChart className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    Gantt
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-[11px] sm:text-xs md:text-sm h-7 sm:h-8 px-2 sm:px-3">
                     <Filter className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      {viewMode === "list"
                        ? (statusFilter || listTimeFilter !== "all")
                          ? [
                              statusFilter ? statusConfig[statusFilter]?.label : null,
                              listTimeFilter !== "all" ? listTimeFilter.charAt(0).toUpperCase() + listTimeFilter.slice(1) : null,
                            ].filter(Boolean).join(" · ")
                          : "Filter"
                        : ganttTimeFilter !== "all"
                        ? ganttTimeFilter.charAt(0).toUpperCase() + ganttTimeFilter.slice(1)
                        : "Filter"}
                      {((viewMode === "list" && (statusFilter || listTimeFilter !== "all")) || (viewMode === "gantt" && ganttTimeFilter !== "all")) && (
                        <span
                          role="button"
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (viewMode === "list") {
                              setStatusFilter(null);
                              setListTimeFilter("all");
                            } else {
                              setGanttTimeFilter("all");
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {viewMode === "list" ? (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Status</div>
                        {[
                          { value: "open", label: "Open" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                          { value: "overdue", label: "Overdue" },
                        ].map((s) => {
                          const StatusIcon = statusConfig[s.value]?.icon || Clock;
                          return (
                            <DropdownMenuItem
                              key={s.value}
                              className="gap-2"
                              onSelect={() => setStatusFilter(statusFilter === s.value ? null : s.value)}
                            >
                              <StatusIcon className="h-4 w-4" />
                              {s.label}
                              {statusFilter === s.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
                            </DropdownMenuItem>
                          );
                        })}
                        <div className="my-1 h-px bg-border" />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Time Range</div>
                        {[
                          { value: "all", label: "All" },
                          { value: "day", label: "Day" },
                          { value: "week", label: "Week" },
                          { value: "month", label: "Month" },
                        ].map((t) => (
                          <DropdownMenuItem
                            key={t.value}
                            className="gap-2"
                            onSelect={() => setListTimeFilter(t.value as "all" | "day" | "week" | "month")}
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {t.label}
                            {listTimeFilter === t.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Time Range</div>
                        {[
                          { value: "all", label: "All" },
                          { value: "day", label: "Day" },
                          { value: "week", label: "Week" },
                          { value: "month", label: "Month" },
                        ].map((t) => (
                          <DropdownMenuItem
                            key={t.value}
                            className="gap-2"
                            onSelect={() => setGanttTimeFilter(t.value as "all" | "day" | "week" | "month")}
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {t.label}
                            {ganttTimeFilter === t.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] sm:text-xs md:text-sm h-7 sm:h-8 px-2 sm:px-3"
                  onClick={() => {
                    setSectionForm({ name: "" });
                    setSectionDialogOpen(true);
                  }}
                >
                  <FolderPlus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Add Section</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No sections yet</p>
                </div>
              ) : viewMode === "gantt" ? (
                filteredGanttTasks.length === 0 && ganttTimeFilter !== "all" ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Filter className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No tasks found for this {ganttTimeFilter}</p>
                    <p className="text-sm mt-1">Try a different time range or clear the filter</p>
                  </div>
                ) : (
                  <NSOGanttChart
                    sections={filteredGanttSections}
                    tasks={filteredGanttTasks}
                    onTaskUpdate={handleGanttTaskUpdate}
                    onTaskClick={handleTaskClick}
                    onAddTask={handleAddTask}
                    onTaskReorder={handleTaskReorder}
                  />
                )
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <Accordion type="multiple" defaultValue={sections.map((s) => s.id)} className="space-y-3">
                    {sections.map((section) => {
                      const sectionTasks = filteredListTasks.filter((t) => t.section_id === section.id);
                      if ((statusFilter || listTimeFilter !== "all") && sectionTasks.length === 0) return null;
                      const allSectionTasks = tasks.filter((t) => t.section_id === section.id);
                      return (
                        <AccordionItem key={section.id} value={section.id} className="border rounded-lg">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="font-medium">{section.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {allSectionTasks.filter((t) => t.status === "completed").length}/{allSectionTasks.length}
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

        {/* Budget Tab */}
        <TabsContent value="budget" className="m-0">
          <Card>
            <CardContent className="pt-6">
              <NSOStoreBudgetSection checklistId={checklist.id} masterId={checklist.master_id} />
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
                  {MANUAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
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
      <Dialog open={taskDetailsDialogOpen} onOpenChange={(open) => {
        setTaskDetailsDialogOpen(open);
        if (!open) setIsEditingTask(false);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>{isEditingTask ? "Edit Task" : selectedTask?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              {isEditingTask ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Task Name *</Label>
                    <Input
                      value={editTaskForm.name}
                      onChange={(e) => setEditTaskForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editTaskForm.description}
                      onChange={(e) => setEditTaskForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Task details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Owner</Label>
                      <Input
                        value={editTaskForm.owner}
                        onChange={(e) => setEditTaskForm((f) => ({ ...f, owner: e.target.value }))}
                        placeholder="Responsible person"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={editTaskForm.vendor_id || "none"}
                        onValueChange={(v) => setEditTaskForm((f) => ({ ...f, vendor_id: v === "none" ? "" : v }))}
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
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editTaskForm.start_date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editTaskForm.start_date ? format(editTaskForm.start_date, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover" align="start">
                          <Calendar mode="single" selected={editTaskForm.start_date || undefined} onSelect={(d) => setEditTaskForm((f) => ({ ...f, start_date: d || null }))} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editTaskForm.end_date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editTaskForm.end_date ? format(editTaskForm.end_date, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover" align="start">
                          <Calendar mode="single" selected={editTaskForm.end_date || undefined} onSelect={(d) => setEditTaskForm((f) => ({ ...f, end_date: d || null }))} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editTaskForm.status} onValueChange={(v) => setEditTaskForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Owner</Label>
                      <p className="font-medium">{selectedTask.owner || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {(() => {
                          const effStatus = getEffectiveStatus(selectedTask);
                          return effStatus === "overdue" ? (
                            <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>
                          ) : null;
                        })()}
                        <Badge variant="outline">
                          {statusConfig[getEffectiveStatus(selectedTask)]?.label || selectedTask.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Start Date</Label>
                      <p className="font-medium">{selectedTask.start_date ? format(new Date(selectedTask.start_date), "PPP") : "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">End Date</Label>
                      <p className="font-medium">{selectedTask.end_date ? format(new Date(selectedTask.end_date), "PPP") : "-"}</p>
                    </div>
                    {selectedTask.vendor_id && (
                      <div>
                        <Label className="text-muted-foreground">Vendor</Label>
                        <p className="font-medium">
                          {vendors.find((v) => v.id === selectedTask.vendor_id)?.name || "-"}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedTask.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="mt-1 text-sm">{selectedTask.description}</p>
                    </div>
                  )}
                  <NSOTaskAttachments taskId={selectedTask.id} />
                </>
              )}
              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex gap-2">
                  {isEditingTask ? (
                    <>
                      <Button onClick={handleSaveEditTask} disabled={!editTaskForm.name.trim()}>
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingTask(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setIsEditingTask(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          deleteTaskMutation.mutate(selectedTask.id);
                          setTaskDetailsDialogOpen(false);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
