import { useState, useEffect } from "react";
import { Plus, Search, ClipboardCheck, Loader2, Clock, CheckCircle, AlertCircle, Store, MoreHorizontal, Pencil, Trash, Calendar, List, Camera, Upload, MapPin, Filter, Image, Eye, XCircle, AlertTriangle } from "lucide-react";
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
import { ImageComparisonSlider } from "@/components/vm/ImageComparisonSlider";
import { VMCaptureDialog } from "@/components/vm/VMCaptureDialog";

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
  compliance_status: string;
  review_status: string | null;
  match_percentage: number | null;
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
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
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

const complianceStatusColors: Record<string, string> = {
  open: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  completed_on_time: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  completed_but_delayed: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const complianceStatusLabels: Record<string, string> = {
  open: "Open",
  delayed: "Delayed",
  completed_on_time: "Completed On Time",
  completed_but_delayed: "Completed But Delayed",
};

const reviewStatusOptions = [
  { value: "match", label: "Match" },
  { value: "average_match", label: "Average Match" },
  { value: "low_match", label: "Low Match" },
  { value: "no_match", label: "No Match" },
];

const reviewStatusColors: Record<string, string> = {
  match: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  average_match: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  low_match: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  no_match: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
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
  
  // Task detail/view state
  const [viewTaskOpen, setViewTaskOpen] = useState(false);
  const [selectedViewTask, setSelectedViewTask] = useState<ComplianceTask | null>(null);
  const [compareMode, setCompareMode] = useState<"slider" | "side-by-side">("slider");
  
  // Photo capture state (direct camera)
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  
  // Review state (auto-calculated)
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [matchPercentage, setMatchPercentage] = useState<number>(0);
  const [matchReasoning, setMatchReasoning] = useState<string>("");
  const [analyzingMatch, setAnalyzingMatch] = useState(false);
  
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

  const handleEdit = (task: ComplianceTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    // Open view dialog with task details
    setSelectedViewTask(task);
    setCapturedImage(task.submitted_photo_url || null);
    setCapturedFile(null);
    setSubmissionNotes(task.submission_notes || "");
    setReviewStatus(task.review_status || "");
    setMatchPercentage(task.match_percentage || 0);
    setMatchReasoning(""); // Reset reasoning - it's only available during live analysis
    setLocation(task.submitted_latitude && task.submitted_longitude ? {
      lat: task.submitted_latitude,
      lng: task.submitted_longitude,
      address: task.submitted_location_address || `${task.submitted_latitude.toFixed(6)}, ${task.submitted_longitude.toFixed(6)}`,
    } : null);
    setViewTaskOpen(true);
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

  // Direct camera capture functions
  const handleCameraClick = (task: ComplianceTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedViewTask(task);
    setCapturedImage(task.submitted_photo_url || null);
    setCapturedFile(null);
    setSubmissionNotes(task.submission_notes || "");
    setReviewStatus(task.review_status || "");
    setMatchPercentage(task.match_percentage || 0);
    setLocation(null);
    setViewTaskOpen(true);
    
    // Trigger camera dialog after task dialog opens
    setTimeout(() => {
      setCameraDialogOpen(true);
      getLocation();
    }, 100);
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

  const handleCameraCapture = (imageData: string, file: File) => {
    setCapturedImage(imageData);
    setCapturedFile(file);
    getLocation();
  };

  const handlePhotoSave = async () => {
    if (!selectedViewTask) return;

    // If no new file but has existing photo, just close
    if (!capturedFile && selectedViewTask.submitted_photo_url) {
      setViewTaskOpen(false);
      return;
    }

    if (!capturedFile) {
      toast({ title: "Error", description: "Please capture a photo first", variant: "destructive" });
      return;
    }

    setUploading(true);

    // Upload image to storage
    const fileExt = capturedFile.name.split(".").pop();
    const fileName = `submissions/${selectedViewTask.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("vm-images")
      .upload(fileName, capturedFile);

    if (uploadError) {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("vm-images").getPublicUrl(fileName);
    const submittedPhotoUrl = urlData.publicUrl;

    // Determine compliance status based on submission time vs due date
    const now = new Date();
    const dueDate = new Date(selectedViewTask.due_date);
    const complianceStatus = now <= dueDate ? "completed_on_time" : "completed_but_delayed";

    // Auto-analyze image match if planogram exists
    let analysisResult: { matchPercentage: number; reviewStatus: string; reasoning: string } | null = null;
    
    if (selectedViewTask.planogram?.image_url) {
      setAnalyzingMatch(true);
      try {
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-vm-compliance', {
          body: {
            planogramImageUrl: selectedViewTask.planogram.image_url,
            submittedImageUrl: submittedPhotoUrl
          }
        });

        if (analysisError) {
          console.error("Analysis error:", analysisError);
          toast({ title: "Warning", description: "Photo saved but match analysis failed", variant: "destructive" });
        } else if (analysisData) {
          // Check if it's a placeholder image error
          if (analysisData.error === "placeholder_image") {
            toast({ 
              title: "Analysis Skipped", 
              description: "Planogram is a placeholder image. Upload a real planogram for auto-analysis.",
              variant: "default" 
            });
            // Don't set analysis result - leave for manual review
          } else {
            analysisResult = analysisData;
            setMatchPercentage(analysisData.matchPercentage);
            setReviewStatus(analysisData.reviewStatus);
            setMatchReasoning(analysisData.reasoning);
          }
        }
      } catch (err) {
        console.error("Failed to analyze compliance:", err);
      }
      setAnalyzingMatch(false);
    }

    // Update task with submission data and analysis results
    const { error: updateError } = await supabase
      .from("vm_compliance_tasks")
      .update({
        submitted_photo_url: submittedPhotoUrl,
        submitted_at: now.toISOString(),
        submitted_latitude: location?.lat || null,
        submitted_longitude: location?.lng || null,
        submitted_location_address: location?.address || null,
        submission_notes: submissionNotes || null,
        status: "submitted",
        compliance_status: complianceStatus,
        review_status: analysisResult?.reviewStatus || null,
        match_percentage: analysisResult?.matchPercentage || null,
      })
      .eq("id", selectedViewTask.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to save photo", variant: "destructive" });
      setUploading(false);
      return;
    }

    const statusLabel = analysisResult 
      ? `Match: ${analysisResult.matchPercentage}% (${reviewStatusOptions.find(r => r.value === analysisResult?.reviewStatus)?.label})`
      : complianceStatusLabels[complianceStatus];
    
    toast({ 
      title: "Photo Saved & Analyzed", 
      description: statusLabel
    });
    setViewTaskOpen(false);
    setCapturedFile(null);
    setCapturedImage(null);
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
        compliance_status: "open",
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
      {/* Camera Capture Dialog */}
      <VMCaptureDialog
        open={cameraDialogOpen}
        onOpenChange={setCameraDialogOpen}
        onCapture={handleCameraCapture}
      />

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
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
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
                      <div className="flex items-center gap-3">
                        {/* Photo thumbnail */}
                        <div className="relative h-10 w-10 rounded overflow-hidden border bg-muted flex-shrink-0">
                          {task.submitted_photo_url ? (
                            <img 
                              src={task.submitted_photo_url} 
                              alt="Submitted" 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Image className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.assigned_user && (
                            <p className="text-sm text-muted-foreground">
                              Assigned to: {task.assigned_user.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{task.store?.name || "-"}</TableCell>
                    <TableCell>{task.planogram?.title || "-"}</TableCell>
                    <TableCell>{new Date(task.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={complianceStatusColors[task.compliance_status] || ""}>
                        {complianceStatusLabels[task.compliance_status] || task.compliance_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.review_status ? (
                        <div className="flex flex-col gap-1">
                          <Badge className={reviewStatusColors[task.review_status] || ""}>
                            {reviewStatusOptions.find(r => r.value === task.review_status)?.label}
                          </Badge>
                          {task.match_percentage !== null && (
                            <span className="text-xs text-muted-foreground">{task.match_percentage}% match</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Camera button - opens camera directly */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => handleCameraClick(task, e)}
                          title="Capture Photo"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleEdit(task, e)}>
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
          onTaskClick={handleRowClick}
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

      {/* Task View/Photo Dialog */}
      <Dialog open={viewTaskOpen} onOpenChange={setViewTaskOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedViewTask?.title}</DialogTitle>
            <DialogDescription>
              {selectedViewTask?.store?.name} • Due: {selectedViewTask?.due_date ? new Date(selectedViewTask.due_date).toLocaleString() : "-"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {selectedViewTask && (
              <div className="space-y-6 pb-4">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Compliance Status</Label>
                    <Badge className={`block mt-1 ${complianceStatusColors[selectedViewTask.compliance_status] || ""}`}>
                      {complianceStatusLabels[selectedViewTask.compliance_status] || selectedViewTask.compliance_status}
                    </Badge>
                  </div>
                  {selectedViewTask.submitted_at && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Submitted At</Label>
                      <p className="text-sm font-medium mt-1">{new Date(selectedViewTask.submitted_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Photo Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Actual Photo</Label>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setCameraDialogOpen(true);
                        if (!location) getLocation();
                      }}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {capturedImage ? "Retake Photo" : "Capture Photo"}
                    </Button>
                  </div>
                  
                  {capturedImage ? (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={capturedImage} alt="Captured" className="w-full h-64 object-cover" />
                    </div>
                  ) : (
                    <div 
                      className="rounded-lg border-2 border-dashed h-64 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setCameraDialogOpen(true);
                        if (!location) getLocation();
                      }}
                    >
                      <div className="text-center text-muted-foreground">
                        <Camera className="h-12 w-12 mx-auto mb-2" />
                        <p>Click to capture photo</p>
                      </div>
                    </div>
                  )}

                  {/* Location Info */}
                  <div className="p-3 rounded-lg bg-muted flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {gettingLocation ? (
                        <span className="text-muted-foreground">Getting location...</span>
                      ) : location ? (
                        <span>{location.address}</span>
                      ) : (
                        <span className="text-muted-foreground">Location not available</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add notes about the display..."
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      className="mt-2"
                      rows={2}
                    />
                  </div>

                  {/* Save Photo Button */}
                  {(capturedFile || !selectedViewTask.submitted_photo_url) && (
                    <Button 
                      onClick={handlePhotoSave} 
                      disabled={!capturedFile || uploading}
                      className="w-full"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Save Photo
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Image Comparison Section - Only show if both images exist */}
                {selectedViewTask.planogram?.image_url && capturedImage && (
                  <div className="space-y-3 border-t pt-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">Compare with Planogram</Label>
                      <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as "slider" | "side-by-side")}>
                        <TabsList className="h-8">
                          <TabsTrigger value="slider" className="text-xs px-2">Slider</TabsTrigger>
                          <TabsTrigger value="side-by-side" className="text-xs px-2">Side by Side</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {compareMode === "slider" ? (
                      <ImageComparisonSlider
                        baseImage={selectedViewTask.planogram.image_url}
                        actualImage={capturedImage}
                        baseLabel="Planogram"
                        actualLabel="Actual"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-2 block text-sm">Planogram (Base)</Label>
                          <div className="rounded-lg overflow-hidden border">
                            <img
                              src={selectedViewTask.planogram.image_url}
                              alt="Planogram"
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Actual Photo</Label>
                          <div className="rounded-lg overflow-hidden border">
                            <img
                              src={capturedImage}
                              alt="Actual"
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-calculated Review Results */}
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">AI Match Analysis</Label>
                        {analyzingMatch && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </div>
                        )}
                      </div>
                      
                      {(reviewStatus || selectedViewTask.review_status) ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-muted-foreground">Match Status</Label>
                              <Badge className={`mt-2 ${reviewStatusColors[reviewStatus || selectedViewTask.review_status || ""] || ""}`}>
                                {reviewStatusOptions.find(r => r.value === (reviewStatus || selectedViewTask.review_status))?.label}
                              </Badge>
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">Match Percentage</Label>
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${
                                      (matchPercentage || selectedViewTask.match_percentage || 0) >= 90 ? 'bg-green-500' :
                                      (matchPercentage || selectedViewTask.match_percentage || 0) >= 60 ? 'bg-blue-500' :
                                      (matchPercentage || selectedViewTask.match_percentage || 0) >= 20 ? 'bg-orange-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${matchPercentage || selectedViewTask.match_percentage || 0}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-lg">{matchPercentage || selectedViewTask.match_percentage || 0}%</span>
                              </div>
                            </div>
                          </div>
                          
                          {matchReasoning && (
                            <div className="p-3 rounded bg-muted">
                              <Label className="text-xs text-muted-foreground">AI Analysis</Label>
                              <p className="text-sm mt-1">{matchReasoning}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Match analysis will be automatically calculated when you save the photo.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Show planogram reference if no actual photo yet */}
                {selectedViewTask.planogram?.image_url && !capturedImage && (
                  <div className="space-y-2">
                    <Label>Reference Planogram</Label>
                    <div className="rounded-lg overflow-hidden border">
                      <img 
                        src={selectedViewTask.planogram.image_url} 
                        alt="Planogram reference" 
                        className="w-full h-48 object-cover"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedViewTask.planogram.title}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
