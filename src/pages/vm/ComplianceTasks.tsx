import { useState, useEffect } from "react";
import { Plus, Search, ClipboardCheck, Loader2, Clock, CheckCircle, AlertCircle, Store, MoreHorizontal, Pencil, Trash, Calendar, List } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelectCombobox, MultiSelectOption } from "@/components/ui/multi-select-combobox";
import { ComplianceCalendarView } from "@/components/vm/ComplianceCalendarView";

const taskSchema = z.object({
  planogramId: z.string().min(1, "Planogram is required"),
  storeIds: z.array(z.string()).min(1, "At least one store is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  frequency: z.string().min(1, "Frequency is required"),
  dueDate: z.string().min(1, "Due date is required"),
  assignedToUserId: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

type ComplianceTask = {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  due_date: string;
  status: string;
  assigned_to: string | null;
  assigned_to_user_id: string | null;
  is_recurring: boolean | null;
  parent_task_id: string | null;
  planogram_id: string | null;
  store_id: string | null;
  created_at: string;
  planogram: { id: string; title: string; zone: string } | null;
  store: { id: string; name: string } | null;
  assigned_user: { id: string; username: string } | null;
};

type Planogram = {
  id: string;
  title: string;
  zone: string;
};

type StoreType = {
  id: string;
  name: string;
};

type UserProfile = {
  id: string;
  username: string;
};

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  correction_required: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export default function ComplianceTasks() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ComplianceTask | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ComplianceTask | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      planogramId: "",
      storeIds: [],
      title: "",
      description: "",
      frequency: "one-time",
      dueDate: "",
      assignedToUserId: "",
    },
  });

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchData = async () => {
    const storeIds = Array.from(accessibleStoreIds);
    
    // Build tasks query with store filter
    let tasksQuery = supabase
      .from("vm_compliance_tasks")
      .select(`
        *,
        planogram:planograms(id, title, zone),
        store:stores(id, name),
        assigned_user:profiles!vm_compliance_tasks_assigned_to_user_id_fkey(id, username)
      `)
      .order("due_date", { ascending: true });
    
    if (!isAdmin && storeIds.length > 0) {
      tasksQuery = tasksQuery.in("store_id", storeIds);
    }
    
    const [tasksRes, planogramsRes, storesRes, usersRes] = await Promise.all([
      tasksQuery,
      supabase.from("planograms").select("id, title, zone").eq("status", "active"),
      supabase.from("stores").select("id, name").eq("status", "active"),
      supabase.from("profiles").select("id, username").eq("status", "active").order("username"),
    ]);

    if (tasksRes.error) {
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
    } else {
      setTasks(tasksRes.data as ComplianceTask[] || []);
    }
    setPlanograms(planogramsRes.data || []);
    // Filter stores for non-admins
    const allStores = storesRes.data || [];
    setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
    setUsers(usersRes.data || []);
    setLoading(false);
  };

  const storeOptions: MultiSelectOption[] = stores.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const handleOpenCreate = () => {
    setEditingTask(null);
    form.reset({
      planogramId: "",
      storeIds: [],
      title: "",
      description: "",
      frequency: "one-time",
      dueDate: "",
      assignedToUserId: "",
    });
    setOpen(true);
  };

  const handleEdit = (task: ComplianceTask) => {
    setEditingTask(task);
    form.reset({
      planogramId: task.planogram_id || "",
      storeIds: task.store_id ? [task.store_id] : [],
      title: task.title,
      description: task.description || "",
      frequency: task.frequency,
      dueDate: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
      assignedToUserId: task.assigned_to_user_id || "",
    });
    setOpen(true);
  };

  const handleRowClick = (task: ComplianceTask) => {
    handleEdit(task);
  };

  const handleDeleteClick = (task: ComplianceTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    
    const { error } = await supabase
      .from("vm_compliance_tasks")
      .delete()
      .eq("id", taskToDelete.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Task deleted" });
      fetchData();
    }
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
  };

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onSubmit = async (data: TaskFormData) => {
    // Handle "none" value for user assignment
    const assignedUserId = data.assignedToUserId === "none" ? null : data.assignedToUserId || null;

    if (editingTask) {
      // Update existing task
      const { error } = await supabase
        .from("vm_compliance_tasks")
        .update({
          planogram_id: data.planogramId,
          store_id: data.storeIds[0], // For edit, only one store
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          due_date: new Date(data.dueDate).toISOString(),
          assigned_to_user_id: assignedUserId,
          is_recurring: data.frequency !== "one-time",
        })
        .eq("id", editingTask.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Task updated" });
        form.reset();
        setOpen(false);
        setEditingTask(null);
        fetchData();
      }
    } else {
      // Create new tasks (bulk insert for multiple stores)
      const tasksToInsert = data.storeIds.map(storeId => ({
        planogram_id: data.planogramId,
        store_id: storeId,
        title: data.title,
        description: data.description || null,
        frequency: data.frequency,
        due_date: new Date(data.dueDate).toISOString(),
        assigned_to_user_id: assignedUserId,
        is_recurring: data.frequency !== "one-time",
      }));

      const { error } = await supabase.from("vm_compliance_tasks").insert(tasksToInsert);

      if (error) {
        toast({ title: "Error", description: "Failed to create task(s)", variant: "destructive" });
      } else {
        toast({ 
          title: "Success", 
          description: data.storeIds.length > 1 
            ? `Created ${data.storeIds.length} compliance tasks` 
            : "Compliance task created" 
        });
        form.reset();
        setOpen(false);
        fetchData();
      }
    }
  };

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.store?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.planogram?.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Compliance Tasks</h1>
          <p className="text-muted-foreground">Manage store display compliance tasks</p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setEditingTask(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingTask ? "Edit Compliance Task" : "Create Compliance Task"}</DialogTitle>
              <DialogDescription>
                {editingTask ? "Update task details." : "Create a new compliance task for one or more stores."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Update Spring Collection Display" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="planogramId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planogram</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select planogram" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {planograms.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storeIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{editingTask ? "Store" : "Store(s)"}</FormLabel>
                        {editingTask ? (
                          <Select 
                            onValueChange={(val) => field.onChange([val])} 
                            value={field.value[0] || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select store" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stores.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <MultiSelectCombobox
                              options={storeOptions}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder="Select stores..."
                              searchPlaceholder="Search stores..."
                              emptyMessage="No stores found."
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Task instructions..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {frequencyOptions.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date & Time</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setOpen(false);
                      setEditingTask(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingTask ? "Update Task" : "Create Task"}</Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>
          
          {viewMode === "list" && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Planogram</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No compliance tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow 
                      key={task.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(task)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {task.title}
                          {task.is_recurring && (
                            <Badge variant="outline" className="text-xs">Recurring</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.planogram?.title || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          {task.store?.name || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.frequency}</Badge>
                      </TableCell>
                      <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>{task.assigned_user?.username || task.assigned_to || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[task.status] || statusColors.pending}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(task);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => handleDeleteClick(task, e)}
                              className="text-destructive"
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ComplianceCalendarView 
            tasks={tasks} 
            onTaskClick={handleEdit} 
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
