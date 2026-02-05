import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  Plus,
  CalendarIcon,
  Trash2,
  FileText,
  ChevronRight,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function NewStoreOpening() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteChecklistDialogOpen, setDeleteChecklistDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<StoreChecklist | null>(null);

  // Form states
  const [assignForm, setAssignForm] = useState({
    store_id: "",
    master_id: "",
    start_date: new Date(),
  });

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch checklist masters with total duration
  const { data: masters = [] } = useQuery({
    queryKey: ["nso-checklist-masters-active-with-duration"],
    queryFn: async () => {
      // Fetch masters
      const { data: mastersData, error: mastersError } = await supabase
        .from("nso_checklist_masters")
        .select("id, name, store_type")
        .eq("status", "active")
        .order("name");
      if (mastersError) throw mastersError;

      // Fetch all sections and tasks to calculate total duration per master
      const { data: sectionsData } = await supabase
        .from("nso_master_sections")
        .select("id, master_id");
      
      const { data: tasksData } = await supabase
        .from("nso_master_tasks")
        .select("section_id, duration_days");

      // Build a map of section_id -> master_id
      const sectionToMaster: Record<string, string> = {};
      sectionsData?.forEach((s) => {
        sectionToMaster[s.id] = s.master_id;
      });

      // Calculate total duration per master
      const masterDurations: Record<string, number> = {};
      tasksData?.forEach((t) => {
        const masterId = sectionToMaster[t.section_id];
        if (masterId) {
          masterDurations[masterId] = (masterDurations[masterId] || 0) + (t.duration_days || 0);
        }
      });

      return mastersData.map((m) => ({
        ...m,
        total_duration_days: masterDurations[m.id] || 0,
      }));
    },
  });

  // Calculate end date based on selected master and start date
  const selectedMaster = masters.find((m) => m.id === assignForm.master_id);
  const calculatedEndDate = selectedMaster && assignForm.start_date
    ? addDays(assignForm.start_date, selectedMaster.total_duration_days - 1)
    : null;

  // Fetch store checklists
  const { data: checklists = [], isLoading } = useQuery({
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

  // Fetch task counts and end dates for all checklists
  const { data: taskCounts = {} } = useQuery({
    queryKey: ["nso-task-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_store_tasks")
        .select("checklist_id, status, end_date");
      if (error) throw error;
      
      const counts: Record<string, { total: number; completed: number; latestEndDate: string | null }> = {};
      data.forEach((task) => {
        if (!counts[task.checklist_id]) {
          counts[task.checklist_id] = { total: 0, completed: 0, latestEndDate: null };
        }
        counts[task.checklist_id].total++;
        if (task.status === "completed") {
          counts[task.checklist_id].completed++;
        }
        if (task.end_date) {
          if (!counts[task.checklist_id].latestEndDate || 
              task.end_date > counts[task.checklist_id].latestEndDate) {
            counts[task.checklist_id].latestEndDate = task.end_date;
          }
        }
      });
      return counts;
    },
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
      
      const storeSqft = storeData?.store_size_sqft || 0;
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Fetch active sq ft budget rate matching the store size range
      const { data: sqftRates } = await supabase
        .from("sqft_budget_master")
        .select("price_per_sqft, min_sqft, max_sqft")
        .eq("status", "active")
        .or(`effective_from.is.null,effective_from.lte.${today}`)
        .order("effective_from", { ascending: false });
      
      // Find the rate that matches the store's sq ft
      let ratePerSqft = 0;
      if (sqftRates && sqftRates.length > 0) {
        const matchingRate = sqftRates.find((rate) => {
          const min = rate.min_sqft || 0;
          const max = rate.max_sqft;
          return storeSqft >= min && (max === null || storeSqft <= max);
        });
        ratePerSqft = matchingRate?.price_per_sqft || 0;
      }
      
      // Fetch master for planned_budget
      const { data: masterData } = await supabase
        .from("nso_checklist_masters")
        .select("name, planned_budget")
        .eq("id", data.master_id)
        .single();
      
      // Calculate prescribed budget
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
    onSuccess: (checklist) => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["nso-task-counts"] });
      toast.success("Checklist assigned successfully");
      setAssignDialogOpen(false);
      setAssignForm({ store_id: "", master_id: "", start_date: new Date() });
      // Navigate to the new checklist
      navigate(`/stores/new-opening/${checklist.id}`);
    },
    onError: () => toast.error("Failed to assign checklist"),
  });

  // Delete checklist mutation
  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      const { error } = await supabase
        .from("nso_store_checklists")
        .delete()
        .eq("id", checklistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-store-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["nso-task-counts"] });
      toast.success("Checklist deleted");
      setDeleteChecklistDialogOpen(false);
      setChecklistToDelete(null);
    },
    onError: () => toast.error("Failed to delete checklist"),
  });

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

  const getProgress = (checklistId: string) => {
    const counts = taskCounts[checklistId];
    if (!counts || counts.total === 0) return 0;
    return Math.round((counts.completed / counts.total) * 100);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">New Store Opening</h1>
          <p className="text-muted-foreground">Manage store opening checklists</p>
        </div>
        <Button onClick={() => setAssignDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Checklist
        </Button>
      </div>

      {/* Checklists List */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Active Checklists</h2>
        </div>
        <div className="divide-y">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : checklists.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No checklists yet</p>
              <p className="text-sm">Assign a checklist to a store</p>
            </div>
          ) : (
            checklists.map((checklist) => {
              const progress = getProgress(checklist.id);
              const counts = taskCounts[checklist.id] || { total: 0, completed: 0, latestEndDate: null };
              
              return (
                <div
                  key={checklist.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors group"
                  onClick={() => navigate(`/stores/new-opening/${checklist.id}`)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{checklist.stores?.name || "Unknown Store"}</h4>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">{checklist.name}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge
                          variant={checklist.status === "completed" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {checklist.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Start: {format(new Date(checklist.start_date), "MMM d, yyyy")}
                          {counts.latestEndDate && (
                            <> → End: {format(new Date(counts.latestEndDate), "MMM d, yyyy")}</>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {/* Progress */}
                    <div className="hidden sm:flex items-center gap-4 min-w-[200px]">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {counts.completed}/{counts.total} tasks
                        </p>
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
              );
            })
          )}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !assignForm.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {assignForm.start_date
                        ? format(assignForm.start_date, "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={assignForm.start_date}
                      onSelect={(d) => setAssignForm((f) => ({ ...f, start_date: d || new Date() }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center text-sm">
                  {calculatedEndDate ? (
                    <span>{format(calculatedEndDate, "PPP")}</span>
                  ) : (
                    <span className="text-muted-foreground">Select template</span>
                  )}
                </div>
                {selectedMaster && (
                  <p className="text-xs text-muted-foreground">
                    {selectedMaster.total_duration_days} days from template
                  </p>
                )}
              </div>
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
    </div>
  );
}
