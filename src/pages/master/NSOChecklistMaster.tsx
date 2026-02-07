import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  FolderPlus,
  ListPlus,
  GripVertical,
  Copy,
  Package,
  Calculator,
  Paperclip,
} from "lucide-react";
import { NSOmasterTaskAttachments } from "@/components/nso/NSOmasterTaskAttachments";
import { NSOmasterBudgetSection } from "@/components/nso/NSOmasterBudgetSection";
import { format } from "date-fns";

interface ChecklistMaster {
  id: string;
  name: string;
  store_type: string | null;
  description: string | null;
  status: string;
  created_at: string;
  planned_budget: number | null;
  prescribed_sqft: number | null;
  estimated_budget: number | null;
  budget: number | null;
  actual_budget: number | null;
}

interface MasterSection {
  id: string;
  master_id: string;
  name: string;
  sort_order: number;
}

interface MasterTask {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  duration_days: number;
  from_buildup_days: number;
  sort_order: number;
  vendor_id: string | null;
}

interface Vendor {
  id: string;
  name: string;
}

interface AssetMaster {
  id: string;
  name: string;
  criticality: string;
  standard_price: number | null;
  categories?: { name: string } | null;
}

interface NsoMasterAsset {
  id: string;
  master_id: string;
  asset_master_id: string;
  quantity: number;
  notes: string | null;
  sort_order: number;
  vendor_id: string | null;
  asset_masters?: AssetMaster;
}

const storeTypes = ["Flagship", "Standard", "Express", "Outlet", "Kiosk"];

export default function NSOChecklistMaster() {
  const queryClient = useQueryClient();
  const [selectedMaster, setSelectedMaster] = useState<ChecklistMaster | null>(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<ChecklistMaster | null>(null);
  const [editingSection, setEditingSection] = useState<MasterSection | null>(null);
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null);
  const [editingAsset, setEditingAsset] = useState<NsoMasterAsset | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [taskDetailDialogOpen, setTaskDetailDialogOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<MasterTask | null>(null);
  const [masterForm, setMasterForm] = useState({
    name: "",
    store_type: "",
    description: "",
    status: "active",
  });
  const [sectionForm, setSectionForm] = useState({ name: "" });
  const [taskForm, setTaskForm] = useState({
    name: "",
    description: "",
    duration_days: 1,
    from_buildup_days: 0,
    vendor_id: "",
  });
  const [assetForm, setAssetForm] = useState({
    asset_master_id: "",
    quantity: 1,
    notes: "",
    vendor_id: "",
  });

  // Budget form state removed - now handled by NSOmasterBudgetSection component

  // Fetch checklist masters
  const { data: masters = [] } = useQuery({
    queryKey: ["nso-checklist-masters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_checklist_masters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChecklistMaster[];
    },
  });

  // Fetch sections for selected master
  const { data: sections = [] } = useQuery({
    queryKey: ["nso-master-sections", selectedMaster?.id],
    queryFn: async () => {
      if (!selectedMaster) return [];
      const { data, error } = await supabase
        .from("nso_master_sections")
        .select("*")
        .eq("master_id", selectedMaster.id)
        .order("sort_order");
      if (error) throw error;
      return data as MasterSection[];
    },
    enabled: !!selectedMaster,
  });

  // Fetch tasks for all sections
  const { data: tasks = [] } = useQuery({
    queryKey: ["nso-master-tasks", selectedMaster?.id],
    queryFn: async () => {
      if (!selectedMaster || sections.length === 0) return [];
      const sectionIds = sections.map((s) => s.id);
      const { data, error } = await supabase
        .from("nso_master_tasks")
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order");
      if (error) throw error;
      return data as MasterTask[];
    },
    enabled: !!selectedMaster && sections.length > 0,
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

  // Fetch asset masters
  const { data: assetMasters = [] } = useQuery({
    queryKey: ["asset-masters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_masters")
        .select("id, name, criticality, standard_price, categories(name)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as AssetMaster[];
    },
  });

  // Fetch required assets for selected master
  const { data: requiredAssets = [] } = useQuery({
    queryKey: ["nso-master-assets", selectedMaster?.id],
    queryFn: async () => {
      if (!selectedMaster) return [];
      const { data, error } = await supabase
        .from("nso_master_assets")
        .select("*, asset_masters(id, name, criticality, standard_price, categories(name)), vendors:vendor_id(id, name)")
        .eq("master_id", selectedMaster.id)
        .order("sort_order");
      if (error) throw error;
      return data as NsoMasterAsset[];
    },
    enabled: !!selectedMaster,
  });

  // Mutations
  const createMasterMutation = useMutation({
    mutationFn: async (data: typeof masterForm) => {
      const { error } = await supabase.from("nso_checklist_masters").insert({
        name: data.name,
        store_type: data.store_type || null,
        description: data.description || null,
        status: data.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-checklist-masters"] });
      toast.success("Checklist master created");
      setMasterDialogOpen(false);
      resetMasterForm();
    },
    onError: () => toast.error("Failed to create checklist master"),
  });

  const updateMasterMutation = useMutation({
    mutationFn: async (data: typeof masterForm & { id: string }) => {
      const { error } = await supabase
        .from("nso_checklist_masters")
        .update({
          name: data.name,
          store_type: data.store_type || null,
          description: data.description || null,
          status: data.status,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-checklist-masters"] });
      toast.success("Checklist master updated");
      setMasterDialogOpen(false);
      resetMasterForm();
    },
    onError: () => toast.error("Failed to update checklist master"),
  });

  const deleteMasterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_checklist_masters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-checklist-masters"] });
      toast.success("Checklist master deleted");
      if (selectedMaster) setSelectedMaster(null);
    },
    onError: () => toast.error("Failed to delete checklist master"),
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: { name: string; master_id: string }) => {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 0;
      
      // Create the master section
      const { data: newSection, error } = await supabase.from("nso_master_sections").insert({
        ...data,
        sort_order: maxOrder,
      }).select().single();
      if (error) throw error;

      // Propagate to all assigned store checklists
      const { data: assignedChecklists } = await supabase
        .from("nso_store_checklists")
        .select("id")
        .eq("master_id", data.master_id);

      if (assignedChecklists && assignedChecklists.length > 0) {
        const storeSections = assignedChecklists.map(checklist => ({
          checklist_id: checklist.id,
          name: data.name,
          sort_order: maxOrder,
          is_custom: false,
        }));
        await supabase.from("nso_store_sections").insert(storeSections);
      }

      return newSection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-sections"] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-sections"] });
      toast.success("Section created and synced to all assigned stores");
      setSectionDialogOpen(false);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to create section"),
  });

  const updateSectionMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const { error } = await supabase
        .from("nso_master_sections")
        .update({ name: data.name })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-sections"] });
      toast.success("Section updated");
      setSectionDialogOpen(false);
      setEditingSection(null);
      setSectionForm({ name: "" });
    },
    onError: () => toast.error("Failed to update section"),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_master_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-sections", "nso-master-tasks"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { section_id: string }) => {
      const sectionTasks = tasks.filter((t) => t.section_id === data.section_id);
      const maxOrder = sectionTasks.length > 0 ? Math.max(...sectionTasks.map((t) => t.sort_order)) + 1 : 0;
      
      // Create the master task
      const { data: newTask, error } = await supabase.from("nso_master_tasks").insert({
        section_id: data.section_id,
        name: data.name,
        description: data.description || null,
        duration_days: data.duration_days,
        from_buildup_days: data.from_buildup_days || 0,
        sort_order: maxOrder,
        vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
      }).select().single();
      if (error) throw error;

      // Get the master section to find its name
      const { data: masterSection } = await supabase
        .from("nso_master_sections")
        .select("name, master_id")
        .eq("id", data.section_id)
        .single();

      if (masterSection) {
        // Find all assigned store checklists
        const { data: assignedChecklists } = await supabase
          .from("nso_store_checklists")
          .select("id")
          .eq("master_id", masterSection.master_id);

        if (assignedChecklists && assignedChecklists.length > 0) {
          // For each checklist, find the corresponding section and add the task with calculated dates
          for (const checklist of assignedChecklists) {
            const { data: storeSection } = await supabase
              .from("nso_store_sections")
              .select("id")
              .eq("checklist_id", checklist.id)
              .eq("name", masterSection.name)
              .eq("is_custom", false)
              .single();

            if (storeSection) {
              // Offset-based: use the checklist's start_date + from_buildup_days
              const { data: checklistData } = await supabase
                .from("nso_store_checklists")
                .select("start_date")
                .eq("id", checklist.id)
                .single();

              let startDate: string | null = null;
              let endDate: string | null = null;

              if (checklistData?.start_date) {
                const buildupDate = new Date(checklistData.start_date);
                const calcStart = new Date(buildupDate);
                calcStart.setDate(calcStart.getDate() + (data.from_buildup_days || 0));
                const calcEnd = new Date(calcStart);
                calcEnd.setDate(calcEnd.getDate() + (data.duration_days || 1) - 1);
                startDate = calcStart.toISOString().split("T")[0];
                endDate = calcEnd.toISOString().split("T")[0];
              }

              await supabase.from("nso_store_tasks").insert({
                section_id: storeSection.id,
                checklist_id: checklist.id,
                name: data.name,
                description: data.description || null,
                start_date: startDate,
                end_date: endDate,
                sort_order: maxOrder,
                is_custom: false,
                status: "pending",
                vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
              });
            }
          }
        }
      }

      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-tasks"] });
      toast.success("Task created and synced to all assigned stores");
      setTaskDialogOpen(false);
      resetTaskForm();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm & { id: string }) => {
      const { error } = await supabase
        .from("nso_master_tasks")
        .update({
          name: data.name,
          description: data.description || null,
          duration_days: data.duration_days,
          from_buildup_days: data.from_buildup_days || 0,
          vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-tasks"] });
      toast.success("Task updated");
      setTaskDialogOpen(false);
      resetTaskForm();
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_master_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-tasks"] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const duplicateMasterMutation = useMutation({
    mutationFn: async (master: ChecklistMaster) => {
      // Create new master
      const { data: newMaster, error: masterError } = await supabase
        .from("nso_checklist_masters")
        .insert({
          name: `${master.name} (Copy)`,
          store_type: master.store_type,
          description: master.description,
          status: "active",
        })
        .select()
        .single();
      if (masterError) throw masterError;

      // Copy sections
      const { data: oldSections } = await supabase
        .from("nso_master_sections")
        .select("*")
        .eq("master_id", master.id);

      if (oldSections && oldSections.length > 0) {
        for (const section of oldSections) {
          const { data: newSection, error: sectionError } = await supabase
            .from("nso_master_sections")
            .insert({
              master_id: newMaster.id,
              name: section.name,
              sort_order: section.sort_order,
            })
            .select()
            .single();
          if (sectionError) throw sectionError;

          // Copy tasks for this section
          const { data: oldTasks } = await supabase
            .from("nso_master_tasks")
            .select("*")
            .eq("section_id", section.id);

          if (oldTasks && oldTasks.length > 0) {
            await supabase.from("nso_master_tasks").insert(
              oldTasks.map((task) => ({
                section_id: newSection.id,
                name: task.name,
                description: task.description,
                duration_days: task.duration_days,
                from_buildup_days: task.from_buildup_days || 0,
                sort_order: task.sort_order,
              }))
            );
          }
        }
      }
      // Copy required assets
      const { data: oldAssets } = await supabase
        .from("nso_master_assets")
        .select("*")
        .eq("master_id", master.id);

      if (oldAssets && oldAssets.length > 0) {
        await supabase.from("nso_master_assets").insert(
          oldAssets.map((asset) => ({
            master_id: newMaster.id,
            asset_master_id: asset.asset_master_id,
            quantity: asset.quantity,
            notes: asset.notes,
            sort_order: asset.sort_order,
            vendor_id: asset.vendor_id,
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-checklist-masters"] });
      toast.success("Checklist master duplicated");
    },
    onError: () => toast.error("Failed to duplicate checklist master"),
  });

  // Asset mutations
  const createAssetMutation = useMutation({
    mutationFn: async (data: typeof assetForm & { master_id: string }) => {
      const maxOrder = requiredAssets.length > 0 ? Math.max(...requiredAssets.map((a) => a.sort_order)) + 1 : 0;
      
      const { data: newAsset, error } = await supabase.from("nso_master_assets").insert({
        master_id: data.master_id,
        asset_master_id: data.asset_master_id,
        quantity: data.quantity,
        notes: data.notes || null,
        sort_order: maxOrder,
        vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
      }).select().single();
      if (error) throw error;

      // Propagate to all assigned store checklists
      const { data: assignedChecklists } = await supabase
        .from("nso_store_checklists")
        .select("id")
        .eq("master_id", data.master_id);

      if (assignedChecklists && assignedChecklists.length > 0) {
        const storeAssets = assignedChecklists.map(checklist => ({
          checklist_id: checklist.id,
          asset_master_id: data.asset_master_id,
          quantity: data.quantity,
          notes: data.notes || null,
          sort_order: maxOrder,
          is_custom: false,
          status: "pending",
          vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
        }));
        await supabase.from("nso_store_assets").insert(storeAssets);
      }

      return newAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-assets"] });
      queryClient.invalidateQueries({ queryKey: ["nso-store-assets"] });
      toast.success("Required asset added and synced to all assigned stores");
      setAssetDialogOpen(false);
      resetAssetForm();
    },
    onError: () => toast.error("Failed to add required asset"),
  });

  const updateAssetMutation = useMutation({
    mutationFn: async (data: typeof assetForm & { id: string }) => {
      const { error } = await supabase
        .from("nso_master_assets")
        .update({
          asset_master_id: data.asset_master_id,
          quantity: data.quantity,
          notes: data.notes || null,
          vendor_id: data.vendor_id && data.vendor_id !== "none" ? data.vendor_id : null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-assets"] });
      toast.success("Required asset updated");
      setAssetDialogOpen(false);
      resetAssetForm();
    },
    onError: () => toast.error("Failed to update required asset"),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nso_master_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-assets"] });
      toast.success("Required asset removed");
    },
    onError: () => toast.error("Failed to remove required asset"),
  });

  // Budget mutation removed - now handled by NSOmasterBudgetSection component

  const resetMasterForm = () => {
    setMasterForm({ name: "", store_type: "", description: "", status: "active" });
    setEditingMaster(null);
  };

  const resetTaskForm = () => {
    setTaskForm({ name: "", description: "", duration_days: 1, from_buildup_days: 0, vendor_id: "" });
    setEditingTask(null);
    setSelectedSectionId(null);
  };

  const resetAssetForm = () => {
    setAssetForm({ asset_master_id: "", quantity: 1, notes: "", vendor_id: "" });
    setEditingAsset(null);
  };

  const handleEditAsset = (asset: NsoMasterAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      asset_master_id: asset.asset_master_id,
      quantity: asset.quantity,
      notes: asset.notes || "",
      vendor_id: asset.vendor_id || "",
    });
    setAssetDialogOpen(true);
  };

  const handleEditMaster = (master: ChecklistMaster) => {
    setEditingMaster(master);
    setMasterForm({
      name: master.name,
      store_type: master.store_type || "",
      description: master.description || "",
      status: master.status,
    });
    setMasterDialogOpen(true);
  };

  const handleEditSection = (section: MasterSection) => {
    setEditingSection(section);
    setSectionForm({ name: section.name });
    setSectionDialogOpen(true);
  };

  const handleEditTask = (task: MasterTask) => {
    setEditingTask(task);
    setTaskForm({
      name: task.name,
      description: task.description || "",
      duration_days: task.duration_days,
      from_buildup_days: task.from_buildup_days || 0,
      vendor_id: task.vendor_id || "",
    });
    setSelectedSectionId(task.section_id);
    setTaskDialogOpen(true);
  };

  const handleAddTask = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setTaskDialogOpen(true);
  };

  const handleMasterSubmit = () => {
    if (!masterForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (editingMaster) {
      updateMasterMutation.mutate({ ...masterForm, id: editingMaster.id });
    } else {
      createMasterMutation.mutate(masterForm);
    }
  };

  const handleSectionSubmit = () => {
    if (!sectionForm.name.trim()) {
      toast.error("Section name is required");
      return;
    }
    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, name: sectionForm.name });
    } else if (selectedMaster) {
      createSectionMutation.mutate({ name: sectionForm.name, master_id: selectedMaster.id });
    }
  };

  const handleTaskSubmit = () => {
    if (!taskForm.name.trim()) {
      toast.error("Task name is required");
      return;
    }
    if (editingTask) {
      updateTaskMutation.mutate({ ...taskForm, id: editingTask.id });
    } else if (selectedSectionId) {
      createTaskMutation.mutate({ ...taskForm, section_id: selectedSectionId });
    }
  };

  const getTasksForSection = (sectionId: string) => tasks.filter((t) => t.section_id === sectionId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">NSO Checklist Master</h1>
          <p className="text-muted-foreground">
            Create and manage new store opening checklist templates
          </p>
        </div>
        <Button onClick={() => setMasterDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Checklist Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Masters List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Checklist Templates</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {masters.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No checklist templates yet</p>
                  <p className="text-sm">Create your first template to get started</p>
                </div>
              ) : (
                masters.map((master) => (
                  <div
                    key={master.id}
                    className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedMaster?.id === master.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedMaster(master)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{master.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {master.store_type && (
                            <Badge variant="outline" className="text-xs">
                              {master.store_type}
                            </Badge>
                          )}
                          <Badge
                            variant={master.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {master.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {format(new Date(master.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMasterMutation.mutate(master);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMaster(master);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMasterMutation.mutate(master.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Master Details / Sections & Tasks */}
        <div className="lg:col-span-2">
          {selectedMaster ? (
            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{selectedMaster.name}</h3>
                    {selectedMaster.description && (
                      <p className="text-sm text-muted-foreground">{selectedMaster.description}</p>
                    )}
                  </div>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="tasks">
                      <ListPlus className="h-4 w-4 mr-2" />
                      Sections & Tasks
                    </TabsTrigger>
                    <TabsTrigger value="assets">
                      <Package className="h-4 w-4 mr-2" />
                      Required Assets
                      {requiredAssets.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {requiredAssets.length}
                        </Badge>
                      )}
                    </TabsTrigger>
              <TabsTrigger value="budget">
                <Calculator className="h-4 w-4 mr-2" />
                Budget
              </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {activeTab === "tasks" && (
                <div className="p-4">
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => {
                        setEditingSection(null);
                        setSectionForm({ name: "" });
                        setSectionDialogOpen(true);
                      }}
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                  {sections.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No sections yet</p>
                      <p className="text-sm">Add sections to organize your checklist tasks</p>
                    </div>
                  ) : (
                    <Accordion type="multiple" defaultValue={sections.map((s) => s.id)} className="space-y-3">
                      {sections.map((section) => (
                        <AccordionItem
                          key={section.id}
                          value={section.id}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 flex-1">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{section.name}</span>
                              <Badge variant="outline" className="ml-2">
                                {getTasksForSection(section.id).length} tasks
                              </Badge>
                            </div>
                            <div className="flex gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditSection(section)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
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
                          <AccordionContent>
                            <div className="pt-2 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Task Name</TableHead>
                                    <TableHead>
                                      <div>
                                        <span>From Store Buildup Date (Days)</span>
                                        <p className="text-xs font-normal text-muted-foreground">Days offset from store buildup start date</p>
                                      </div>
                                    </TableHead>
                                    <TableHead>Duration (Days)</TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getTasksForSection(section.id).map((task) => (
                                    <TableRow key={task.id}>
                                      <TableCell>
                                        <div
                                          className="cursor-pointer hover:text-primary transition-colors"
                                          onClick={() => {
                                            setSelectedTaskForDetail(task);
                                            setTaskDetailDialogOpen(true);
                                          }}
                                        >
                                          <span className="font-medium underline decoration-dotted underline-offset-4">{task.name}</span>
                                          {task.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 no-underline">
                                              {task.description}
                                            </p>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="font-mono">
                                          Day {task.from_buildup_days || 0}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{task.duration_days}</TableCell>
                                      <TableCell>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleEditTask(task)}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => deleteTaskMutation.mutate(task.id)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {getTasksForSection(section.id).length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                                        No tasks in this section
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => handleAddTask(section.id)}
                              >
                                <ListPlus className="h-4 w-4 mr-2" />
                                Add Task
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              )}

              {activeTab === "assets" && (
                <div className="p-4">
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => {
                        setEditingAsset(null);
                        resetAssetForm();
                        setAssetDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Required Asset
                    </Button>
                  </div>
                  {requiredAssets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No required assets yet</p>
                      <p className="text-sm">Add assets from Asset Master that are required for new store opening</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Criticality</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requiredAssets.map((asset) => (
                          <TableRow key={asset.id}>
                            <TableCell className="font-medium">
                              {asset.asset_masters?.name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {asset.asset_masters?.categories?.name || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  asset.asset_masters?.criticality === "high" 
                                    ? "destructive" 
                                    : asset.asset_masters?.criticality === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {asset.asset_masters?.criticality}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {asset.vendor_id ? vendors.find(v => v.id === asset.vendor_id)?.name || "-" : "-"}
                            </TableCell>
                            <TableCell>{asset.quantity}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {asset.notes || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditAsset(asset)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => deleteAssetMutation.mutate(asset.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                )}

              {activeTab === "budget" && (
                <div className="p-4">
                  <NSOmasterBudgetSection masterId={selectedMaster.id} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="font-medium text-lg mb-2">Select a Template</h3>
              <p className="text-sm">
                Choose a checklist template from the left to view and edit its sections and tasks
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Master Dialog */}
      <Dialog open={masterDialogOpen} onOpenChange={setMasterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMaster ? "Edit Checklist Template" : "Create Checklist Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={masterForm.name}
                onChange={(e) => setMasterForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Standard Store Opening Checklist"
              />
            </div>
            <div className="space-y-2">
              <Label>Store Type</Label>
              <Select
                value={masterForm.store_type}
                onValueChange={(v) => setMasterForm((f) => ({ ...f, store_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {storeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={masterForm.description}
                onChange={(e) => setMasterForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe this checklist template..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={masterForm.status}
                onValueChange={(v) => setMasterForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMasterDialogOpen(false);
              resetMasterForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleMasterSubmit}>
              {editingMaster ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
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
            <Button variant="outline" onClick={() => {
              setSectionDialogOpen(false);
              setEditingSection(null);
              setSectionForm({ name: "" });
            }}>
              Cancel
            </Button>
            <Button onClick={handleSectionSubmit}>
              {editingSection ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                placeholder="Task details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Store Buildup Date (Days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={taskForm.from_buildup_days}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, from_buildup_days: parseInt(e.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Days offset from the store buildup start date
                </p>
              </div>
              <div className="space-y-2">
                <Label>Duration (Days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={taskForm.duration_days}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, duration_days: parseInt(e.target.value) || 1 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Days to complete this task
                </p>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTaskDialogOpen(false);
              resetTaskForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleTaskSubmit}>
              {editingTask ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Required Asset" : "Add Required Asset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Asset *</Label>
              <Select
                value={assetForm.asset_master_id}
                onValueChange={(v) => setAssetForm((f) => ({ ...f, asset_master_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset from Asset Master" />
                </SelectTrigger>
                <SelectContent>
                  {assetMasters.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} {asset.categories?.name ? `(${asset.categories.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Asset Value - auto-fetched and read-only */}
            {(() => {
              const selectedAsset = assetMasters.find(a => a.id === assetForm.asset_master_id);
              const assetValue = selectedAsset?.standard_price ?? 0;
              const totalCost = assetValue * assetForm.quantity;
              
              return (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Asset Value</Label>
                      <Input
                        type="text"
                        value={assetValue > 0 ? `₹ ${assetValue.toLocaleString('en-IN')}` : "Not set"}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground">
                        From Asset Master
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={assetForm.quantity}
                        onChange={(e) =>
                          setAssetForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))
                        }
                      />
                    </div>
                  </div>
                  {assetValue > 0 && (
                    <div className="space-y-2">
                      <Label>Total Cost</Label>
                      <Input
                        type="text"
                        value={`₹ ${totalCost.toLocaleString('en-IN')}`}
                        readOnly
                        className="bg-muted cursor-not-allowed font-semibold"
                      />
                      <p className="text-xs text-muted-foreground">
                        Asset Value × Quantity
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select
                value={assetForm.vendor_id}
                onValueChange={(v) => setAssetForm((f) => ({ ...f, vendor_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor (optional)" />
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
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={assetForm.notes}
                onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssetDialogOpen(false);
              resetAssetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!assetForm.asset_master_id) {
                  toast.error("Please select an asset");
                  return;
                }
                if (editingAsset) {
                  updateAssetMutation.mutate({ ...assetForm, id: editingAsset.id });
                } else if (selectedMaster) {
                  createAssetMutation.mutate({ ...assetForm, master_id: selectedMaster.id });
                }
              }}
            >
              {editingAsset ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Master Task Detail Dialog */}
      <Dialog open={taskDetailDialogOpen} onOpenChange={setTaskDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTaskForDetail?.name}</DialogTitle>
          </DialogHeader>
          {selectedTaskForDetail && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">From Buildup Date</Label>
                  <p className="font-medium">Day {selectedTaskForDetail.from_buildup_days || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">{selectedTaskForDetail.duration_days} day(s)</p>
                </div>
                {selectedTaskForDetail.vendor_id && (
                  <div>
                    <Label className="text-muted-foreground">Vendor</Label>
                    <p className="font-medium">
                      {vendors.find((v) => v.id === selectedTaskForDetail.vendor_id)?.name || "-"}
                    </p>
                  </div>
                )}
              </div>
              {selectedTaskForDetail.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedTaskForDetail.description}</p>
                </div>
              )}
              <NSOmasterTaskAttachments taskId={selectedTaskForDetail.id} />
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTaskDetailDialogOpen(false);
                    handleEditTask(selectedTaskForDetail);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteTaskMutation.mutate(selectedTaskForDetail.id);
                    setTaskDetailDialogOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
