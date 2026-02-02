import { useState, useEffect } from "react";
import { Plus, Search, Image, Calendar, Loader2, Trash2, Eye, Pencil, Clock, User, Store, Copy } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelectCombobox, MultiSelectOption } from "@/components/ui/multi-select-combobox";

const planogramSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  zone: z.string().min(1, "Zone is required"),
  applicableUpto: z.string().optional(),
  storeIds: z.array(z.string()).optional(),
  frequency: z.string().min(1, "Frequency is required"),
  scheduleTime: z.string().optional(),
  scheduleDaysOfWeek: z.array(z.string()).optional(), // Multiple days for weekly
  scheduleDayOfMonth: z.string().optional(),
  scheduleWeekOfMonth: z.string().optional(),
  scheduleDate: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

type PlanogramFormData = z.infer<typeof planogramSchema>;

type Planogram = {
  id: string;
  title: string;
  description: string | null;
  zone: string;
  image_url: string;
  deadline: string | null;
  status: string;
  created_at: string;
  frequency: string | null;
  schedule_time: string | null;
  schedule_day_of_week: number | null;
  schedule_days_of_week: number[] | null;
  schedule_day_of_month: number | null;
  schedule_week_of_month: number | null;
  schedule_date: string | null;
  assigned_to_user_id: string | null;
  assigned_user?: { username: string } | null;
  stores?: { store_id: string; store?: { name: string } }[];
};

type StoreOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  username: string;
};

const zoneOptions = [
  { value: "window", label: "Window Display" },
  { value: "aisle", label: "Aisle" },
  { value: "counter", label: "Counter" },
  { value: "end-cap", label: "End-Cap" },
  { value: "entrance", label: "Entrance" },
  { value: "checkout", label: "Checkout Area" },
];

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one-time", label: "One Time" },
];

const daysOfWeek = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const weekOfMonthOptions = [
  { value: "1", label: "First" },
  { value: "2", label: "Second" },
  { value: "3", label: "Third" },
  { value: "4", label: "Fourth" },
  { value: "5", label: "Last" },
];

const dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export default function Planograms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPlanogram, setSelectedPlanogram] = useState<Planogram | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planogramToDelete, setPlanogramToDelete] = useState<Planogram | null>(null);
  const { toast } = useToast();

  const form = useForm<PlanogramFormData>({
    resolver: zodResolver(planogramSchema),
    defaultValues: {
      title: "",
      description: "",
      zone: "",
      applicableUpto: "",
      storeIds: [],
      frequency: "one-time",
      scheduleTime: "",
      scheduleDaysOfWeek: [],
      scheduleDayOfMonth: "",
      scheduleWeekOfMonth: "",
      scheduleDate: "",
      assignedToUserId: "",
    },
  });

  const frequency = useWatch({ control: form.control, name: "frequency" });

  useEffect(() => {
    fetchPlanograms();
    fetchStores();
    fetchUsers();
  }, []);

  const fetchPlanograms = async () => {
    const { data, error } = await supabase
      .from("planograms")
      .select(`
        *,
        assigned_user:profiles!planograms_assigned_to_user_id_fkey(username),
        stores:planogram_stores(store_id, store:stores(name))
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load planograms", variant: "destructive" });
    } else {
      setPlanograms(data || []);
    }
    setLoading(false);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from("stores")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    if (data) setStores(data);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("status", "active")
      .order("username");
    if (data) setUsers(data);
  };

  const storeOptions: MultiSelectOption[] = stores.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    form.reset({
      title: "",
      description: "",
      zone: "",
      applicableUpto: "",
      storeIds: [],
      frequency: "one-time",
      scheduleTime: "",
      scheduleDaysOfWeek: [],
      scheduleDayOfMonth: "",
      scheduleWeekOfMonth: "",
      scheduleDate: "",
      assignedToUserId: "",
    });
    setSelectedImage(null);
    setPreviewUrl(null);
    setEditMode(false);
    setCloneMode(false);
    setSelectedPlanogram(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditDialog = async (planogram: Planogram) => {
    setEditMode(true);
    setCloneMode(false);
    setSelectedPlanogram(planogram);
    
    // Get store IDs for this planogram
    const storeIds = planogram.stores?.map((s) => s.store_id) || [];
    
    // Convert days of week to string array
    const scheduleDaysOfWeek = planogram.schedule_days_of_week?.map(String) || 
      (planogram.schedule_day_of_week !== null ? [String(planogram.schedule_day_of_week)] : []);
    
    form.reset({
      title: planogram.title,
      description: planogram.description || "",
      zone: planogram.zone,
      applicableUpto: planogram.deadline ? new Date(planogram.deadline).toISOString().slice(0, 10) : "",
      storeIds,
      frequency: planogram.frequency || "one-time",
      scheduleTime: planogram.schedule_time || "",
      scheduleDaysOfWeek,
      scheduleDayOfMonth: planogram.schedule_day_of_month?.toString() || "",
      scheduleWeekOfMonth: planogram.schedule_week_of_month?.toString() || "",
      scheduleDate: planogram.schedule_date || "",
      assignedToUserId: planogram.assigned_to_user_id || "",
    });
    setPreviewUrl(planogram.image_url);
    setFormOpen(true);
  };

  const openCloneDialog = async (planogram: Planogram) => {
    setEditMode(false);
    setCloneMode(true);
    setSelectedPlanogram(planogram);
    
    // Get store IDs for this planogram
    const storeIds = planogram.stores?.map((s) => s.store_id) || [];
    
    // Convert days of week to string array
    const scheduleDaysOfWeek = planogram.schedule_days_of_week?.map(String) || 
      (planogram.schedule_day_of_week !== null ? [String(planogram.schedule_day_of_week)] : []);
    
    // Set title with "Copy of " prefix
    const newTitle = planogram.title.startsWith("Copy of ") 
      ? planogram.title 
      : `Copy of ${planogram.title}`;
    
    form.reset({
      title: newTitle,
      description: planogram.description || "",
      zone: planogram.zone,
      applicableUpto: planogram.deadline ? new Date(planogram.deadline).toISOString().slice(0, 10) : "",
      storeIds,
      frequency: planogram.frequency || "one-time",
      scheduleTime: planogram.schedule_time || "",
      scheduleDaysOfWeek,
      scheduleDayOfMonth: planogram.schedule_day_of_month?.toString() || "",
      scheduleWeekOfMonth: planogram.schedule_week_of_month?.toString() || "",
      scheduleDate: planogram.schedule_date || "",
      assignedToUserId: planogram.assigned_to_user_id || "",
    });
    setPreviewUrl(planogram.image_url);
    setFormOpen(true);
  };

  const openViewDialog = (planogram: Planogram) => {
    setSelectedPlanogram(planogram);
    setViewOpen(true);
  };

  const openDeleteDialog = (planogram: Planogram) => {
    setPlanogramToDelete(planogram);
    setDeleteDialogOpen(true);
  };

  const onSubmit = async (data: PlanogramFormData) => {
    // For new planograms (not clone), require image upload
    if (!editMode && !cloneMode && !selectedImage) {
      toast({ title: "Error", description: "Please select an image", variant: "destructive" });
      return;
    }

    setUploading(true);
    
    let imageUrl = selectedPlanogram?.image_url || "";

    // Upload new image if selected
    if (selectedImage) {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `planograms/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("vm-images")
        .upload(fileName, selectedImage);

      if (uploadError) {
        toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("vm-images").getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    // Convert string array to number array for days of week
    const scheduleDaysOfWeek = data.scheduleDaysOfWeek?.map(Number).filter(n => !isNaN(n)) || null;

    const planogramData = {
      title: data.title,
      description: data.description || null,
      zone: data.zone,
      image_url: imageUrl,
      deadline: data.applicableUpto ? new Date(data.applicableUpto).toISOString() : null,
      frequency: data.frequency,
      schedule_time: data.scheduleTime || null,
      schedule_days_of_week: scheduleDaysOfWeek && scheduleDaysOfWeek.length > 0 ? scheduleDaysOfWeek : null,
      schedule_day_of_week: null, // Deprecated in favor of schedule_days_of_week
      schedule_day_of_month: data.scheduleDayOfMonth ? parseInt(data.scheduleDayOfMonth) : null,
      schedule_week_of_month: data.scheduleWeekOfMonth ? parseInt(data.scheduleWeekOfMonth) : null,
      schedule_date: data.scheduleDate || null,
      assigned_to_user_id: data.assignedToUserId && data.assignedToUserId !== "none" ? data.assignedToUserId : null,
    };

    if (editMode && selectedPlanogram) {
      // Update existing planogram
      const { error } = await supabase
        .from("planograms")
        .update(planogramData)
        .eq("id", selectedPlanogram.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update planogram", variant: "destructive" });
        setUploading(false);
        return;
      }

      // Update stores - delete existing and insert new
      await supabase.from("planogram_stores").delete().eq("planogram_id", selectedPlanogram.id);
      
      if (data.storeIds && data.storeIds.length > 0) {
        const storeInserts = data.storeIds.map((storeId) => ({
          planogram_id: selectedPlanogram.id,
          store_id: storeId,
        }));
        await supabase.from("planogram_stores").insert(storeInserts);
      }

      toast({ title: "Success", description: "Planogram updated successfully" });
    } else {
      // Create new planogram (or clone)
      const { data: newPlanogram, error } = await supabase
        .from("planograms")
        .insert(planogramData)
        .select()
        .single();

      if (error || !newPlanogram) {
        toast({ title: "Error", description: "Failed to create planogram", variant: "destructive" });
        setUploading(false);
        return;
      }

      // Insert store associations
      if (data.storeIds && data.storeIds.length > 0) {
        const storeInserts = data.storeIds.map((storeId) => ({
          planogram_id: newPlanogram.id,
          store_id: storeId,
        }));
        await supabase.from("planogram_stores").insert(storeInserts);
      }

      toast({ 
        title: "Success", 
        description: cloneMode ? "Planogram cloned successfully" : "Planogram created successfully" 
      });
    }

    resetForm();
    setFormOpen(false);
    fetchPlanograms();
    setUploading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!planogramToDelete) return;

    const { error } = await supabase.from("planograms").delete().eq("id", planogramToDelete.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete planogram", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Planogram removed" });
      fetchPlanograms();
    }
    setDeleteDialogOpen(false);
    setPlanogramToDelete(null);
  };

  const filteredPlanograms = planograms.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.zone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getZoneLabel = (value: string) => 
    zoneOptions.find((z) => z.value === value)?.label || value;

  const getFrequencyLabel = (value: string | null) =>
    frequencyOptions.find((f) => f.value === value)?.label || value || "One Time";

  const getDayOfWeekLabel = (value: number | null) =>
    value !== null ? daysOfWeek.find((d) => d.value === String(value))?.label : null;

  const getWeekOfMonthLabel = (value: number | null) =>
    value !== null ? weekOfMonthOptions.find((w) => w.value === String(value))?.label : null;

  const formatScheduleDescription = (planogram: Planogram) => {
    const parts: string[] = [];
    
    if (planogram.frequency === "daily" && planogram.schedule_time) {
      parts.push(`Daily at ${planogram.schedule_time}`);
    } else if (planogram.frequency === "weekly") {
      // Use new array field if available, fall back to old single field
      const days = planogram.schedule_days_of_week || 
        (planogram.schedule_day_of_week !== null ? [planogram.schedule_day_of_week] : []);
      if (days.length > 0) {
        const dayLabels = days.map(d => getDayOfWeekLabel(d)).filter(Boolean);
        parts.push(`Weekly on ${dayLabels.join(", ")}`);
      }
      if (planogram.schedule_time) parts.push(`at ${planogram.schedule_time}`);
    } else if (planogram.frequency === "monthly") {
      if (planogram.schedule_week_of_month && planogram.schedule_days_of_week && planogram.schedule_days_of_week.length > 0) {
        const week = getWeekOfMonthLabel(planogram.schedule_week_of_month);
        const day = getDayOfWeekLabel(planogram.schedule_days_of_week[0]);
        parts.push(`${week} ${day} of month`);
      } else if (planogram.schedule_day_of_month) {
        parts.push(`Day ${planogram.schedule_day_of_month} of month`);
      }
      if (planogram.schedule_time) parts.push(`at ${planogram.schedule_time}`);
    } else if (planogram.frequency === "one-time" && planogram.schedule_date) {
      parts.push(`On ${new Date(planogram.schedule_date).toLocaleDateString()}`);
      if (planogram.schedule_time) parts.push(`at ${planogram.schedule_time}`);
    }
    
    return parts.join(" ") || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Planogram Repository</h1>
          <p className="text-muted-foreground">Manage master planograms and base photos</p>
        </div>
        <Button className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Add Planogram
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search planograms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredPlanograms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No planograms found. Create your first master planogram.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-4">
            {filteredPlanograms.map((planogram) => (
              <Card key={planogram.id} className="overflow-hidden">
                <div className="aspect-video relative">
                  <img
                    src={planogram.image_url}
                    alt={planogram.title}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-2 right-2">{getZoneLabel(planogram.zone)}</Badge>
                </div>
                <CardHeader className="pb-2">
                  <h3 className="font-semibold">{planogram.title}</h3>
                  {planogram.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{planogram.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pb-2 space-y-1">
                  {planogram.deadline && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Applicable upto: {new Date(planogram.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{getFrequencyLabel(planogram.frequency)}</span>
                    {formatScheduleDescription(planogram) && (
                      <span className="text-xs">({formatScheduleDescription(planogram)})</span>
                    )}
                  </div>
                  {planogram.stores && planogram.stores.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Store className="h-4 w-4" />
                      <span className="truncate">
                        {planogram.stores.length === 1
                          ? planogram.stores[0].store?.name
                          : `${planogram.stores.length} stores`}
                      </span>
                    </div>
                  )}
                  {planogram.assigned_user && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{planogram.assigned_user.username}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openViewDialog(planogram)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCloneDialog(planogram)}
                    title="Clone"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(planogram)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteDialog(planogram)}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit/Clone Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editMode ? "Edit Planogram" : cloneMode ? "Clone Planogram" : "Create Master Planogram"}
            </DialogTitle>
            <DialogDescription>
              {editMode 
                ? "Update the planogram details below." 
                : cloneMode 
                  ? "Create a copy of the planogram with a new title."
                  : "Fill in the details to create a new planogram."}
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
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spring Collection Window Display" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {zoneOptions.map((zone) => (
                            <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>
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
                      <FormLabel>Store(s)</FormLabel>
                      <FormControl>
                        <MultiSelectCombobox
                          options={storeOptions}
                          selected={field.value || []}
                          onChange={field.onChange}
                          placeholder="Select stores..."
                          searchPlaceholder="Search stores..."
                          emptyMessage="No stores found."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedToUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned User</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
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
                        <Textarea placeholder="Describe the display requirements..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="applicableUpto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Applicable Upto</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          {frequencyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dependent fields based on frequency */}
                {frequency === "daily" && (
                  <FormField
                    control={form.control}
                    name="scheduleTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time of Day</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {frequency === "weekly" && (
                  <>
                    <FormField
                      control={form.control}
                      name="scheduleDaysOfWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Days of Week</FormLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {daysOfWeek.map((day) => (
                              <div key={day.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`day-${day.value}`}
                                  checked={field.value?.includes(day.value)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, day.value]);
                                    } else {
                                      field.onChange(current.filter((v) => v !== day.value));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`day-${day.value}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {day.label}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scheduleTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {frequency === "monthly" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="scheduleWeekOfMonth"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Week of Month</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select week" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">-- Specific Day --</SelectItem>
                                {weekOfMonthOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="scheduleDaysOfWeek"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day of Week</FormLabel>
                            <Select 
                              onValueChange={(v) => field.onChange([v])} 
                              value={field.value?.[0] || ""} 
                              disabled={!form.watch("scheduleWeekOfMonth") || form.watch("scheduleWeekOfMonth") === "none"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {daysOfWeek.map((day) => (
                                  <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="scheduleDayOfMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Or Specific Day of Month</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""} disabled={form.watch("scheduleWeekOfMonth") && form.watch("scheduleWeekOfMonth") !== "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select day" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {dayOfMonthOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scheduleTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {frequency === "one-time" && (
                  <>
                    <FormField
                      control={form.control}
                      name="scheduleDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specific Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scheduleTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div>
                  <FormLabel>
                    Base Photo {(editMode || cloneMode) && "(optional - leave empty to keep current)"}
                  </FormLabel>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="cursor-pointer"
                    />
                    {previewUrl && (
                      <div className="mt-2 rounded-lg overflow-hidden border">
                        <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-2">
                  <Button type="button" variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editMode ? "Save Changes" : cloneMode ? "Create Clone" : "Create Planogram"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedPlanogram?.title}</DialogTitle>
            <DialogDescription>View planogram details and image.</DialogDescription>
          </DialogHeader>
          {selectedPlanogram && (
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-4 pb-4">
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selectedPlanogram.image_url}
                    alt={selectedPlanogram.title}
                    className="w-full object-contain max-h-[400px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Zone</p>
                    <p className="font-medium">{getZoneLabel(selectedPlanogram.zone)}</p>
                  </div>
                  {selectedPlanogram.deadline && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Applicable Upto</p>
                      <p className="font-medium">{new Date(selectedPlanogram.deadline).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Frequency</p>
                    <p className="font-medium">{getFrequencyLabel(selectedPlanogram.frequency)}</p>
                  </div>
                  {formatScheduleDescription(selectedPlanogram) && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                      <p className="font-medium">{formatScheduleDescription(selectedPlanogram)}</p>
                    </div>
                  )}
                  {selectedPlanogram.assigned_user && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Assigned User</p>
                      <p className="font-medium">{selectedPlanogram.assigned_user.username}</p>
                    </div>
                  )}
                  {selectedPlanogram.stores && selectedPlanogram.stores.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Stores</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPlanogram.stores.map((s) => (
                          <Badge key={s.store_id} variant="secondary">{s.store?.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {selectedPlanogram.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="mt-1">{selectedPlanogram.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="mt-1">{new Date(selectedPlanogram.created_at).toLocaleString()}</p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setViewOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline" onClick={() => { setViewOpen(false); openCloneDialog(selectedPlanogram); }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Clone
                  </Button>
                  <Button onClick={() => { setViewOpen(false); openEditDialog(selectedPlanogram); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Planogram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{planogramToDelete?.title}"? This action cannot be undone.
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
    </div>
  );
}
