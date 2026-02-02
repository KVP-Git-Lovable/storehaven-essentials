import { useState, useEffect, useRef } from "react";
import { Plus, Search, ClipboardCheck, Loader2, Clock, CheckCircle, AlertCircle, Store, MoreHorizontal, Pencil, Trash, Calendar, List, Camera, Upload, MapPin, Filter } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceCalendarView } from "@/components/vm/ComplianceCalendarView";

const taskSchema = z.object({
  planogramId: z.string().min(1, "Planogram is required"),
  storeId: z.string().min(1, "Store is required"),
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
  submitted_photo_url: string | null;
  submitted_at: string | null;
  submitted_latitude: number | null;
  submitted_longitude: number | null;
  submitted_location_address: string | null;
  submission_notes: string | null;
  planogram: { id: string; title: string; zone: string; image_url: string } | null;
  store: { id: string; name: string } | null;
  assigned_user: { id: string; username: string } | null;
};

type Planogram = {
  id: string;
  title: string;
  zone: string;
  image_url: string;
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
  const [storeFilter, setStoreFilter] = useState<string>("all");
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
  
  // Photo submission state
  const [submitPhotoOpen, setSubmitPhotoOpen] = useState(false);
  const [selectedTaskForPhoto, setSelectedTaskForPhoto] = useState<ComplianceTask | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      planogramId: "",
      storeId: "",
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
        planogram:planograms(id, title, zone, image_url),
        store:stores(id, name),
        assigned_user:profiles!vm_compliance_tasks_assigned_to_user_id_fkey(id, username)
      `)
      .order("due_date", { ascending: true });
    
    if (!isAdmin && storeIds.length > 0) {
      tasksQuery = tasksQuery.in("store_id", storeIds);
    }
    
    const [tasksRes, planogramsRes, storesRes, usersRes] = await Promise.all([
      tasksQuery,
      supabase.from("planograms").select("id, title, zone, image_url").eq("status", "active"),
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

  const handleOpenCreate = () => {
    setEditingTask(null);
    form.reset({
      planogramId: "",
      storeId: "",
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
      storeId: task.store_id || "",
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

  // Photo submission functions
  const handleOpenPhotoSubmit = (task: ComplianceTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskForPhoto(task);
    setCapturedImage(null);
    setCapturedFile(null);
    setSubmissionNotes("");
    setLocation(null);
    setSubmitPhotoOpen(true);
    getLocation();
  };

  const getLocation = () => {
    setGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error("Location error:", error);
          setGettingLocation(false);
        }
      );
    } else {
      setGettingLocation(false);
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoSubmit = async () => {
    if (!selectedTaskForPhoto || !capturedFile) {
      toast({ title: "Error", description: "Please capture a photo", variant: "destructive" });
      return;
    }

    setUploading(true);

    // Upload image to storage
    const fileExt = capturedFile.name.split(".").pop();
    const fileName = `submissions/${selectedTaskForPhoto.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("vm-images")
      .upload(fileName, capturedFile);

    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("vm-images").getPublicUrl(fileName);

    // Update task with submission data
    const { error: updateError } = await supabase
      .from("vm_compliance_tasks")
      .update({
        submitted_photo_url: urlData.publicUrl,
        submitted_at: new Date().toISOString(),
        submitted_latitude: location?.lat || null,
        submitted_longitude: location?.lng || null,
        submitted_location_address: location?.address || null,
        submission_notes: submissionNotes || null,
        status: "submitted",
      })
      .eq("id", selectedTaskForPhoto.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to submit photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    toast({ title: "Success", description: "Photo submitted for review" });
    setSubmitPhotoOpen(false);
    setSelectedTaskForPhoto(null);
    setCapturedImage(null);
    setCapturedFile(null);
    setSubmissionNotes("");
    fetchData();
    setUploading(false);
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
          store_id: data.storeId,
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
      // Create new task (single store)
      const { error } = await supabase.from("vm_compliance_tasks").insert({
        planogram_id: data.planogramId,
        store_id: data.storeId,
        title: data.title,
        description: data.description || null,
        frequency: data.frequency,
        due_date: new Date(data.dueDate).toISOString(),
        assigned_to_user_id: assignedUserId,
        is_recurring: data.frequency !== "one-time",
      });

      if (error) {
        toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Compliance task created" });
        form.reset();
        setOpen(false);
        fetchData();
      }
    }
  };

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.store?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.planogram?.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStore = storeFilter === "all" || task.store_id === storeFilter;
    
    return matchesSearch && matchesStore;
  });

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
                {editingTask ? "Update task details." : "Create a new compliance task."}
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
                    name="storeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                            <SelectItem value="none">-- Unassigned --</SelectItem>
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
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingTask ? "Save Changes" : "Create Task"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Store Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")} className="ml-auto">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "list" ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Planogram</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No compliance tasks found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow 
                    key={task.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(task)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.assigned_user && (
                          <p className="text-sm text-muted-foreground">
                            Assigned to: {task.assigned_user.username}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{task.store?.name || "-"}</TableCell>
                    <TableCell>{task.planogram?.title || "-"}</TableCell>
                    <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{task.frequency}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[task.status] || ""}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(task.status === "pending" || task.status === "correction_required") && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => handleOpenPhotoSubmit(task, e)}
                            title="Submit Photo"
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(task); }}>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ComplianceCalendarView 
          tasks={filteredTasks} 
          onTaskClick={handleEdit}
        />
      )}

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
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Submission Dialog */}
      <Dialog open={submitPhotoOpen} onOpenChange={setSubmitPhotoOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Submit Compliance Photo</DialogTitle>
            <DialogDescription>
              Capture and upload a photo for: {selectedTaskForPhoto?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4 pb-4">
              {/* Task Info */}
              {selectedTaskForPhoto && (
                <div className="p-3 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedTaskForPhoto.title}</span>
                    <Badge>{selectedTaskForPhoto.store?.name}</Badge>
                  </div>
                  {selectedTaskForPhoto.description && (
                    <p className="text-sm text-muted-foreground">{selectedTaskForPhoto.description}</p>
                  )}
                </div>
              )}

              {/* Reference Planogram */}
              {selectedTaskForPhoto?.planogram && (
                <div>
                  <Label className="mb-2 block">Reference Planogram</Label>
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={selectedTaskForPhoto.planogram.image_url}
                      alt="Planogram"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTaskForPhoto.planogram.title}</p>
                </div>
              )}

              {/* Photo Capture */}
              <div>
                <Label className="mb-2 block">Capture Photo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCapture}
                  className="hidden"
                />

                {capturedImage ? (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border">
                      <img src={capturedImage} alt="Captured" className="w-full h-48 object-cover" />
                    </div>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Retake Photo
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => fileInputRef.current?.click()} className="w-full h-32" variant="outline">
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8" />
                      <span>Capture Photo</span>
                    </div>
                  </Button>
                )}
              </div>

              {/* Location Info */}
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {gettingLocation ? (
                    <span className="text-sm text-muted-foreground">Getting location...</span>
                  ) : location ? (
                    <span className="text-sm">{location.address}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Location not available</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{new Date().toLocaleString()}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes about the display..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
                <Button type="button" variant="outline" onClick={() => setSubmitPhotoOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePhotoSubmit} disabled={!capturedFile || uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Submit for Review
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
